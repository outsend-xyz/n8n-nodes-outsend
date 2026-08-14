import type { INodeType, INodeTypeDescription } from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

export class Outsend implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Outsend',
		name: 'outsend',
		icon: 'file:outsend.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Interact with the Outsend API: Google Maps scraping, lead enrichment, pipelines and recurring monitoring',
		defaults: {
			name: 'Outsend',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'outsendApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://outsend.xyz',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			// ----------------------------------------------------------------
			//                            Resource
			// ----------------------------------------------------------------
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Job',
						value: 'job',
						description: 'Scraping and enrichment jobs',
					},
					{
						name: 'Pipeline',
						value: 'pipeline',
						description: 'Multi-step no-code pipelines (scrape → enrich → filter → …)',
					},
					{
						name: 'Veille',
						value: 'veille',
						description: 'Recurring monitoring of a completed job or pipeline',
					},
				],
				default: 'job',
			},

			// ----------------------------------------------------------------
			//                          Job operations
			// ----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['job'],
					},
				},
				options: [
					{
						name: 'Create Enrichment Job',
						value: 'createEnrichment',
						action: 'Create an enrichment job',
						description:
							'Enrich the results of a previous job: find emails, collect reviews, extract social profiles or verify email deliverability',
						routing: {
							request: {
								method: 'POST',
								url: '=/api/jobs/{{$parameter.enrichmentType}}',
							},
						},
					},
					{
						name: 'Create Scrape Job',
						value: 'createScrap',
						action: 'Create a google maps scrape job',
						description: 'Start a new Google Maps scraping job',
						routing: {
							request: {
								method: 'POST',
								url: '/api/jobs',
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a job',
						description: 'Get a job with its live status and counters',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/jobs/{{$parameter.jobId}}',
							},
						},
					},
					{
						name: 'Get Download URL',
						value: 'getDownloadUrl',
						action: 'Get the download URL of a job',
						description:
							'Return the export URL of a finished job (CSV, JSON or XLSX), along with its availability',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/jobs/{{$parameter.jobId}}',
							},
							output: {
								postReceive: [
									{
										type: 'set',
										properties: {
											value:
												'={{ { "job_id": $parameter.jobId, "status": $response.body.status, "download_available": $response.body.download_available, "results_count": $response.body.results_count, "download_url": "https://outsend.xyz/api/jobs/" + $parameter.jobId + "/download?format=" + $parameter.format } }}',
										},
									},
								],
							},
						},
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many jobs',
						description: 'List the jobs of the authenticated account, most recent first',
						routing: {
							request: {
								method: 'GET',
								url: '/api/jobs',
							},
						},
					},
				],
				default: 'createScrap',
			},

			// ----------------------------------------------------------------
			//                       Pipeline operations
			// ----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['pipeline'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create and start a pipeline',
						description:
							'Create a pipeline from a JSON definition and start its root jobs immediately',
						routing: {
							request: {
								method: 'POST',
								url: '/api/pipelines',
							},
						},
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a pipeline',
						description:
							'Get a pipeline with its per-node jobs, progress and final output job',
						routing: {
							request: {
								method: 'GET',
								url: '=/api/pipelines/{{$parameter.pipelineId}}',
							},
						},
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many pipelines',
						description: 'List the pipelines of the authenticated account, most recent first',
						routing: {
							request: {
								method: 'GET',
								url: '/api/pipelines',
							},
						},
					},
				],
				default: 'create',
			},

			// ----------------------------------------------------------------
			//                        Veille operations
			// ----------------------------------------------------------------
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['veille'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a veille',
						description:
							'Create a recurring monitoring (veille) on a completed job or pipeline',
						routing: {
							request: {
								method: 'POST',
								url: '/api/veille',
							},
						},
					},
					{
						name: 'Delete',
						value: 'delete',
						action: 'Delete a veille',
						description: 'Soft-delete a veille (its run history is kept)',
						routing: {
							request: {
								method: 'DELETE',
								url: '=/api/veille/{{$parameter.veilleId}}',
							},
						},
					},
					{
						name: 'Get Many',
						value: 'getAll',
						action: 'Get many veilles',
						description: 'List active and paused veilles of the authenticated account',
						routing: {
							request: {
								method: 'GET',
								url: '/api/veille',
							},
							output: {
								postReceive: [
									{
										type: 'rootProperty',
										properties: {
											property: 'items',
										},
									},
								],
							},
						},
					},
				],
				default: 'create',
			},

			// ----------------------------------------------------------------
			//                   Job fields — Create Scrape Job
			// ----------------------------------------------------------------
			{
				displayName: 'Queries',
				name: 'queries',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'plumber, electrician',
				description:
					'Comma-separated list of Google Maps search queries (1 to 20, max 200 characters each)',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['createScrap'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'queries',
						value:
							'={{ $value.split(",").map((q) => q.trim()).filter((q) => q.length > 0) }}',
					},
				},
			},
			{
				displayName: 'Zones',
				name: 'zones',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Lyon 30km, 75011, Bretagne',
				description:
					'Comma-separated list of zones (1 to 50) expressed in the selected country: region, department/county, "City 30km", postal code, or the country name for full coverage',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['createScrap'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'zones',
						value:
							'={{ $value.split(",").map((z) => z.trim()).filter((z) => z.length > 0) }}',
					},
				},
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['createScrap'],
					},
				},
				options: [
					{
						displayName: 'Country (ISO3)',
						name: 'country',
						type: 'string',
						default: 'FRA',
						description: 'ISO3 code of the country the zones belong to',
						routing: {
							send: {
								type: 'body',
								property: 'country',
							},
						},
					},
					{
						displayName: 'Include Reviews',
						name: 'includeReviews',
						type: 'boolean',
						default: false,
						description:
							'Whether to also collect review data during the scrape (increases the job cost)',
						routing: {
							send: {
								type: 'body',
								property: 'include_reviews',
							},
						},
					},
					{
						displayName: 'Stop After ~N Places (Stop At)',
						name: 'stopAt',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 2000000,
						},
						default: 0,
						description:
							'Stop the job once this many result rows have been collected (0 = no limit)',
						routing: {
							send: {
								type: 'body',
								property: 'stop_at',
								value: '={{ $value > 0 ? $value : null }}',
							},
						},
					},
					{
						displayName: 'Scrape Mode',
						name: 'scrapMode',
						type: 'options',
						options: [
							{ name: 'Fast', value: 'fast' },
							{ name: 'Normal', value: 'normal' },
							{ name: 'Ultra', value: 'ultra' },
						],
						default: 'fast',
						description: 'Speed/thoroughness profile of the scrape',
						routing: {
							send: {
								type: 'body',
								property: 'scrap_mode',
							},
						},
					},
				],
			},

			// ----------------------------------------------------------------
			//                 Job fields — Create Enrichment Job
			// ----------------------------------------------------------------
			{
				displayName: 'Enrichment Type',
				name: 'enrichmentType',
				type: 'options',
				required: true,
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['createEnrichment'],
					},
				},
				options: [
					{
						name: 'Emails',
						value: 'emails',
						description: 'Find email addresses from the websites of the source rows',
					},
					{
						name: 'Reviews',
						value: 'reviews',
						description: 'Collect Google Maps reviews for the source rows',
					},
					{
						name: 'Socials',
						value: 'socials',
						description: 'Extract social network profiles from the websites of the source rows',
					},
					{
						name: 'Verify Emails',
						value: 'verify-emails',
						description: 'Check the deliverability of the emails of the source rows',
					},
				],
				default: 'emails',
			},
			{
				displayName: 'Source Job ID',
				name: 'sourceJobId',
				type: 'string',
				required: true,
				default: '',
				description: 'ID of the completed job whose results should be enriched',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['createEnrichment'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'source_job_id',
					},
				},
			},
			{
				displayName: 'Email Mode',
				name: 'emailMode',
				type: 'options',
				options: [
					{ name: 'Normal', value: 'normal' },
					{ name: 'Deep', value: 'deep' },
				],
				default: 'normal',
				description: 'Depth of the email discovery crawl',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['createEnrichment'],
						enrichmentType: ['emails'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'mode',
					},
				},
			},
			{
				displayName: 'Items (JSON)',
				name: 'items',
				type: 'json',
				default: '',
				description:
					'Optional JSON array of rows to enrich (max 10,000), typically a subset of the source job rows (from GET /api/jobs/{id}/items). Leave empty to let the API resolve the rows from the source job.',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['createEnrichment'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'items',
						value:
							'={{ $value ? (typeof $value === "string" ? JSON.parse($value) : $value) : undefined }}',
					},
				},
			},

			// ----------------------------------------------------------------
			//              Job fields — Get / Get Download URL
			// ----------------------------------------------------------------
			{
				displayName: 'Job ID',
				name: 'jobId',
				type: 'string',
				required: true,
				default: '',
				description: 'ID of the job',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['get', 'getDownloadUrl'],
					},
				},
			},
			{
				displayName: 'Format',
				name: 'format',
				type: 'options',
				options: [
					{ name: 'CSV', value: 'csv' },
					{ name: 'JSON', value: 'json' },
					{ name: 'XLSX', value: 'xlsx' },
				],
				default: 'csv',
				description: 'Export format of the download URL',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['getDownloadUrl'],
					},
				},
			},

			// ----------------------------------------------------------------
			//                     Job fields — Get Many
			// ----------------------------------------------------------------
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 500,
				},
				default: 50,
				description: 'Max number of results to return',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['getAll'],
					},
				},
				routing: {
					send: {
						type: 'query',
						property: 'limit',
					},
				},
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				typeOptions: {
					minValue: 0,
				},
				default: 0,
				description: 'Number of results to skip (for pagination)',
				displayOptions: {
					show: {
						resource: ['job'],
						operation: ['getAll'],
					},
				},
				routing: {
					send: {
						type: 'query',
						property: 'offset',
					},
				},
			},

			// ----------------------------------------------------------------
			//                       Pipeline fields
			// ----------------------------------------------------------------
			{
				displayName: 'Name',
				name: 'pipelineName',
				type: 'string',
				default: 'Pipeline',
				description: 'Name of the pipeline (max 120 characters)',
				displayOptions: {
					show: {
						resource: ['pipeline'],
						operation: ['create'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'name',
					},
				},
			},
			{
				displayName: 'Definition (JSON)',
				name: 'definition',
				type: 'json',
				required: true,
				default: '{\n  "nodes": [],\n  "edges": []\n}',
				description:
					'Pipeline definition: {"nodes": [{"id", "type", "config"}], "edges": [{"from", "to"}]}. Node types and their config schema are documented by GET https://outsend.xyz/api/pipelines/schema (public, no auth).',
				displayOptions: {
					show: {
						resource: ['pipeline'],
						operation: ['create'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'definition',
						value: '={{ typeof $value === "string" ? JSON.parse($value) : $value }}',
					},
				},
			},
			{
				displayName: 'Pipeline ID',
				name: 'pipelineId',
				type: 'string',
				required: true,
				default: '',
				description: 'UUID of the pipeline',
				displayOptions: {
					show: {
						resource: ['pipeline'],
						operation: ['get'],
					},
				},
			},

			// ----------------------------------------------------------------
			//                         Veille fields
			// ----------------------------------------------------------------
			{
				displayName: 'Name',
				name: 'veilleName',
				type: 'string',
				required: true,
				default: '',
				description: 'Name of the veille (2 to 200 characters)',
				displayOptions: {
					show: {
						resource: ['veille'],
						operation: ['create'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'name',
					},
				},
			},
			{
				displayName: 'Source Type',
				name: 'sourceType',
				type: 'options',
				options: [
					{ name: 'Job', value: 'job' },
					{ name: 'Pipeline', value: 'pipeline' },
				],
				default: 'job',
				description: 'Whether the veille re-runs a completed job or a completed pipeline',
				displayOptions: {
					show: {
						resource: ['veille'],
						operation: ['create'],
					},
				},
			},
			{
				displayName: 'Source Job ID',
				name: 'veilleSourceJobId',
				type: 'string',
				required: true,
				default: '',
				description: 'ID of the completed job to monitor (must belong to your account)',
				displayOptions: {
					show: {
						resource: ['veille'],
						operation: ['create'],
						sourceType: ['job'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'source_job_id',
					},
				},
			},
			{
				displayName: 'Source Pipeline ID',
				name: 'veilleSourcePipelineId',
				type: 'string',
				required: true,
				default: '',
				description: 'UUID of the completed pipeline to monitor (must belong to your account)',
				displayOptions: {
					show: {
						resource: ['veille'],
						operation: ['create'],
						sourceType: ['pipeline'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'source_pipeline_id',
					},
				},
			},
			{
				displayName: 'Frequency (Days)',
				name: 'frequencyDays',
				type: 'number',
				typeOptions: {
					minValue: 1,
					maxValue: 365,
				},
				required: true,
				default: 7,
				description: 'Re-run the source every N days (1 to 365)',
				displayOptions: {
					show: {
						resource: ['veille'],
						operation: ['create'],
					},
				},
				routing: {
					send: {
						type: 'body',
						property: 'frequency_days',
					},
				},
			},
			{
				displayName: 'Veille ID',
				name: 'veilleId',
				type: 'string',
				required: true,
				default: '',
				description: 'Numeric ID of the veille to delete',
				displayOptions: {
					show: {
						resource: ['veille'],
						operation: ['delete'],
					},
				},
			},
		],
	};
}
