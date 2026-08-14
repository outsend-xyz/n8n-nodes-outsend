import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type {
	IDataObject,
	IHookFunctions,
	INode,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

const OUTSEND_BASE_URL = 'https://outsend.xyz';

/**
 * Outsend only POSTs events to a public https:// address: it refuses to send
 * account data to somewhere it cannot reach, and refuses to send it in clear.
 * A default self-hosted n8n registers its workflows at
 * http://localhost:5678/webhook/... — plaintext AND unreachable, so the API
 * answers 400 and the workflow silently never fires.
 *
 * We catch it here so the user reads what to change instead of a server-side
 * rejection written for the Outsend web app.
 */
function assertDeliverableWebhookUrl(node: INode, webhookUrl: string): void {
	let parsed: URL;
	try {
		parsed = new URL(webhookUrl);
	} catch {
		throw new NodeOperationError(node, `n8n produced an invalid webhook URL: ${webhookUrl}`);
	}

	const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
	const unreachable =
		host === 'localhost' ||
		host === '::1' ||
		host.endsWith('.local') ||
		host.endsWith('.internal') ||
		/^127\./.test(host) ||
		/^10\./.test(host) ||
		/^192\.168\./.test(host) ||
		/^169\.254\./.test(host) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(host);

	if (parsed.protocol === 'https:' && !unreachable) {
		return;
	}

	throw new NodeOperationError(node, 'Outsend cannot deliver events to this n8n instance', {
		description:
			`This workflow is reachable at ${webhookUrl}, but Outsend only sends webhooks to a public ` +
			'https:// address. On n8n Cloud this works out of the box. On a self-hosted instance, put n8n ' +
			'behind HTTPS on a public domain, set WEBHOOK_URL to it (for example ' +
			'WEBHOOK_URL=https://n8n.example.com/), restart n8n, then activate this workflow again. ' +
			'If you cannot expose n8n publicly, use the Outsend node with a Schedule Trigger and poll ' +
			'GET /api/events instead.',
	});
}

function sameEvents(a: unknown, b: unknown): boolean {
	if (!Array.isArray(a) || !Array.isArray(b)) {
		return false;
	}
	const left = [...new Set(a.map(String))].sort().join(',');
	const right = [...new Set(b.map(String))].sort().join(',');
	return left === right;
}

export class OutsendTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Outsend Trigger',
		name: 'outsendTrigger',
		icon: 'file:outsend.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description:
			'Starts the workflow when Outsend sends an event (job, pipeline or veille completion)',
		defaults: {
			name: 'Outsend Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'outsendApi',
				required: true,
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				required: true,
				default: ['job.completed'],
				description: 'The Outsend events that should trigger this workflow',
				options: [
					{
						name: 'Job Cancelled',
						value: 'job.cancelled',
						description: 'A job was cancelled',
					},
					{
						name: 'Job Completed',
						value: 'job.completed',
						description: 'A job finished successfully (export ready)',
					},
					{
						name: 'Job Failed',
						value: 'job.failed',
						description: 'A job failed',
					},
					{
						name: 'Pipeline Cancelled',
						value: 'pipeline.cancelled',
						description: 'A pipeline was cancelled',
					},
					{
						name: 'Pipeline Completed',
						value: 'pipeline.completed',
						description: 'A pipeline finished successfully (final dataset ready)',
					},
					{
						name: 'Pipeline Failed',
						value: 'pipeline.failed',
						description: 'A pipeline failed',
					},
					{
						name: 'Veille Run Completed',
						value: 'veille.run_completed',
						description: 'A monitoring (veille) run finished and its diff is available',
					},
				],
			},
			{
				displayName: 'Verify Signature',
				name: 'verifySignature',
				type: 'boolean',
				default: true,
				description:
					'Whether to verify the X-Outsend-Signature header (HMAC-SHA256 of the raw body with the webhook secret) on incoming deliveries. Recommended.',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const events = this.getNodeParameter('events') as string[];
				const verifySignature = this.getNodeParameter('verifySignature', true) as boolean;

				// GET /api/webhooks lists the account's endpoints as
				// {"webhooks": [...]} — WITHOUT the secrets. Deliberately not
				// wrapped in a try/catch: if the account cannot be listed, the
				// activation must fail loudly. Swallowing the error here used to
				// send us down the static-data path and register a duplicate
				// endpoint on every retry, against a cap of 5 per account.
				const response = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'outsendApi',
					{
						method: 'GET',
						url: `${OUTSEND_BASE_URL}/api/webhooks`,
						json: true,
					},
				)) as IDataObject | IDataObject[];

				const hooks = Array.isArray(response)
					? response
					: ((response.webhooks ?? response.items) as IDataObject[] | undefined);

				if (!Array.isArray(hooks)) {
					throw new NodeOperationError(
						this.getNode(),
						'Unexpected response from GET /api/webhooks: no webhook list found',
					);
				}

				const existing = hooks.find((hook) => hook.url === webhookUrl);
				if (existing === undefined) {
					return false;
				}

				// An endpoint already points here — but it is only USABLE if this
				// workflow still holds the matching secret. The secret is returned
				// once, by POST /api/webhooks, and lives in the workflow static
				// data; a workflow exported and re-imported (or copied to another
				// instance) arrives with that store empty. Answering "it exists"
				// then skips create(), the node has nothing to verify signatures
				// against, and every single delivery is answered 401 — a trigger
				// that looks active and never fires.
				//
				// Same reasoning if the subscribed events drifted from the node's
				// configuration: the remote endpoint would keep delivering the old
				// set. In both cases we drop the stale endpoint and report false,
				// so create() registers a fresh one we fully control.
				const usable =
					(!verifySignature || typeof webhookData.secret === 'string') &&
					sameEvents(existing.events, events);

				if (usable) {
					webhookData.webhookId = existing.id;
					return true;
				}

				try {
					await this.helpers.httpRequestWithAuthentication.call(this, 'outsendApi', {
						method: 'DELETE',
						url: `${OUTSEND_BASE_URL}/api/webhooks/${existing.id}`,
					});
				} catch {
					// Already gone, or gone in the meantime — create() will handle it.
				}
				delete webhookData.webhookId;
				delete webhookData.secret;
				return false;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				if (!webhookUrl) {
					return false;
				}
				assertDeliverableWebhookUrl(this.getNode(), webhookUrl);

				const events = this.getNodeParameter('events') as string[];
				const webhookData = this.getWorkflowStaticData('node');
				const secret = randomBytes(32).toString('hex');

				const response = (await this.helpers.httpRequestWithAuthentication.call(
					this,
					'outsendApi',
					{
						method: 'POST',
						url: `${OUTSEND_BASE_URL}/api/webhooks`,
						body: {
							url: webhookUrl,
							events,
							secret,
						},
						json: true,
					},
				)) as IDataObject;

				if (response.id === undefined) {
					return false;
				}

				webhookData.webhookId = response.id;
				// The API echoes the secret back on creation; keep whichever is set.
				webhookData.secret = (response.secret as string | undefined) ?? secret;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');

				if (webhookData.webhookId !== undefined) {
					try {
						await this.helpers.httpRequestWithAuthentication.call(this, 'outsendApi', {
							method: 'DELETE',
							url: `${OUTSEND_BASE_URL}/api/webhooks/${webhookData.webhookId}`,
						});
					} catch {
						// The endpoint may already be gone (deleted from the Outsend
						// UI, or by a previous half-finished deactivation). We still
						// clear the local ids: keeping them would make the next
						// activation believe it owns a remote endpoint that does not
						// exist, and skip creating one.
					}
					delete webhookData.webhookId;
					delete webhookData.secret;
				}

				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		const verifySignature = this.getNodeParameter('verifySignature') as boolean;

		if (verifySignature) {
			const webhookData = this.getWorkflowStaticData('node');
			const secret = webhookData.secret as string | undefined;
			const headers = this.getHeaderData() as IDataObject;
			const signature = (headers['x-outsend-signature'] as string | undefined) ?? '';

			// The signature covers the RAW bytes Outsend sent. Re-serializing the
			// parsed body would only match by accident (key order, spacing,
			// unicode escaping), so a missing rawBody is reported as its own
			// error rather than hidden behind a generic signature mismatch.
			const req = this.getRequestObject() as unknown as { rawBody?: Buffer };
			const raw = req.rawBody;

			let valid = false;
			let reason = 'Invalid signature';

			if (!secret) {
				reason = 'No webhook secret stored for this node — deactivate and reactivate the workflow';
			} else if (!raw) {
				reason = 'Raw request body unavailable, cannot verify the signature';
			} else if (!signature.startsWith('sha256=')) {
				reason = 'Missing or malformed X-Outsend-Signature header';
			} else {
				const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
				const signatureBuffer = Buffer.from(signature, 'utf8');
				const expectedBuffer = Buffer.from(expected, 'utf8');
				valid =
					signatureBuffer.length === expectedBuffer.length &&
					timingSafeEqual(signatureBuffer, expectedBuffer);
			}

			if (!valid) {
				const res = this.getResponseObject();
				res.status(401).json({ ok: false, error: reason });
				return { noWebhookResponse: true };
			}
		}

		return {
			workflowData: [this.helpers.returnJsonArray(bodyData)],
		};
	}
}
