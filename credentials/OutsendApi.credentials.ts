import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class OutsendApi implements ICredentialType {
	name = 'outsendApi';

	displayName = 'Outsend API';

	icon: Icon = { light: 'file:outsend.svg', dark: 'file:outsend.dark.svg' };

	documentationUrl = 'https://outsend.xyz/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'osk_...',
			description:
				'Your Outsend API key. Create one on outsend.xyz under Settings → API keys. Accounts are invitation-based during the alpha.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://outsend.xyz',
			url: '/api/auth/me',
			method: 'GET',
		},
	};
}
