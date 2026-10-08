# n8n-nodes-outsend

This is an n8n community node package for [Outsend](https://outsend.xyz), the all-in-one B2B lead generation platform: Google Maps scraping, lead enrichment (emails, reviews, social profiles, email verification), no-code pipelines and recurring monitoring.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Installation

Follow the [installation guide for community nodes](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n documentation:

1. In n8n, go to **Settings → Community Nodes**.
2. Select **Install**.
3. Enter `n8n-nodes-outsend` and confirm.

For a manual install on a self-hosted instance:

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-outsend
```

Then restart n8n.

## Credentials

The nodes authenticate with an Outsend API key sent as an `X-API-Key` header.

1. Create an account on [outsend.xyz](https://outsend.xyz). During the alpha, sign-up is invitation-based — start at https://outsend.xyz/join/n8n and the invitation code is applied for you. 
2. In Outsend, go to **Settings → API keys** and create a key (it starts with `osk_`).
3. In n8n, create an **Outsend API** credential and paste the key. The built-in credential test calls `GET /api/auth/me` to confirm it works.

## Nodes

### Outsend

Actions against the Outsend API (`https://outsend.xyz`).

| Resource | Operation | Description |
|---|---|---|
| Job | Create Scrape Job | Start a Google Maps scrape (`POST /api/jobs`): comma-separated queries and zones, optional country (ISO3, default `FRA`), approximate stop threshold (`stop_at`), reviews, scrape mode |
| Job | Create Enrichment Job | Enrich a previous job (`POST /api/jobs/{type}`): Emails (normal/deep), Reviews, Socials, Verify Emails — with source job ID and optional explicit items |
| Job | Get | Fetch one job with live status and counters |
| Job | Get Many | List your jobs, most recent first: Return All (the node walks every page) or up to a Limit |
| Job | Get Download URL | Return the export URL of a job (`/api/jobs/{id}/download?format=csv|json|xlsx`) plus its `download_available` flag |
| Pipeline | Create | Create and start a pipeline from a JSON definition (`POST /api/pipelines`) |
| Pipeline | Get | Fetch a pipeline with per-node jobs, progress and final output job |
| Pipeline | Get Many | List your pipelines |
| Monitor | Create | Create a recurring monitor on a completed job or pipeline (frequency in days) |
| Monitor | Get Many | List your active and paused monitors |
| Monitor | Delete | Soft-delete a monitor |

Tips:

- Pipeline definitions are validated server-side. The node catalog (types, config schema, compatibility rules) is public: `GET https://outsend.xyz/api/pipelines/schema` — no auth needed.
- The module registry is public too: `GET https://outsend.xyz/api/modules-registry`.
- `Get Download URL` returns a URL you can pass to n8n's **HTTP Request** node (with the same credential) to fetch the actual file.

### Outsend Trigger

Webhook trigger. When the workflow is activated, the node registers a webhook with `POST /api/webhooks` (and removes it with `DELETE /api/webhooks/{id}` on deactivation). Available events:

- `job.completed`, `job.failed`, `job.cancelled`
- `pipeline.completed`, `pipeline.failed`
- `veille.run_completed`

**Signature verification** (enabled by default): the node generates a secret at registration time and verifies the `X-Outsend-Signature` header of each delivery — `sha256=` followed by the hex HMAC-SHA256 of the raw request body. Deliveries with a missing or invalid signature are rejected with HTTP 401.

## Compatibility

- Requires n8n version 1.x with community nodes enabled.
- Node.js >= 18.10 for local development.

## Alpha notice

Outsend is in alpha. Accounts are invitation-based, and the API surface used by this package (API keys, `/api/events`, `/api/webhooks`) is being rolled out. If webhook registration fails on your account, the platform-side webhook API may not be enabled yet — the actions in the **Outsend** node work independently of it.

## Development

```bash
npm install
npm run build      # tsc + copy SVG icons to dist/
npm run typecheck  # tsc --noEmit
```

## License

MIT

## Resources

- [Outsend](https://outsend.xyz)
- [Outsend API docs](https://outsend.xyz/docs)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
