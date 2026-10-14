# SciAI

SciAI is a React/TypeScript and Express application for transparent bibliometric, scientometric, and data-analysis workflows.

## Development

```bash
npm install
```

```bash
npm run dev
```

The development server serves both the React app and Express API from the same origin by default. Use `GET /api/health` to confirm the API process is reachable.

## Authentication and deployment

SciAI protects data-changing and AI/ML mutation routes with a server-side API token middleware. This includes dataset upload, sample cohort ingestion, dataset deletion, analysis execution, Smart Merge, OpenAlex import, and other protected POST/DELETE operations.

- `SCIAI_API_TOKEN` or `API_TOKEN` is a server-side secret for protected server-to-server/admin API calls.
- Never expose this value to browser JavaScript.
- Never put API tokens in `VITE_*` variables, localStorage, sessionStorage, URLs, rendered HTML, or a browser-readable config endpoint.
- `VITE_*` values are compiled into the client bundle and are visible to users.

For local loopback-only development, `SCIAI_DEV_AUTH_BYPASS="true"` allows protected mutations only when no API token is configured and the server host is loopback (`localhost`, `127.0.0.1`, or `::1`). Non-loopback deployments fail closed without a configured token.

For hosted browser use, choose one of these safe patterns:

1. **Trusted gateway injection**: authenticate users at a same-origin gateway/reverse proxy, strip client-supplied auth headers, and inject server-side credentials only on the trusted server-to-server hop.
2. **Real browser auth/session**: add a login provider, secure `HttpOnly` cookies, CSRF/Origin protections, and server-side session authorization.
3. **Public upload mode**: if uploads must be open to everyone, set `SCIAI_PUBLIC_UPLOADS="true"` and configure `SCIAI_PUBLIC_ORIGIN` to the exact hosted site origin. This makes only `POST /api/datasets/upload` public; sample cohort loading, Smart Merge, dataset deletion, analysis execution, imports, and AI/ML mutations remain protected.
4. **Read-only hosted UI with admin API mutations**: keep protected mutations unavailable in the browser when token auth is enabled and use server-to-server/admin tools for writes.

Do not add an anonymous token/session bootstrap endpoint. The browser cannot safely receive `SCIAI_API_TOKEN`.

## Terminology

SciAI uses a controlled vocabulary for scientific and product-facing language:

- **Dataset** means the managed/imported data container stored by SciAI.
- **Research corpus** means the publications or bibliographic records selected for analysis.
- **Bibliographic record** means an imported or normalized row-level bibliographic unit.
- **Publication** means a scholarly work counted in scientometric metrics.
- **Data source**, **bibliographic database**, and **bibliographic index** are distinct source concepts and should not be used interchangeably.
- **AI-assisted** output is interpretive; deterministic SciAI metrics remain authoritative, and unsupported values are reported as `unavailable`.

## AI provider configuration

SciAI supports a server-side AI provider router for local Ollama and optional cloud providers (Gemini, Claude, and OpenAI). Deterministic SciAI code remains authoritative for scientometric metrics; AI providers are used only for explanation, summarization, labeling, narrative drafting, and research suggestions grounded in supplied data. Unsupported values must be shown as `unavailable`, not invented.

For local use, install [Ollama](https://ollama.com/), pull the default model, and make sure its local service is running:

```bash
ollama pull qwen2.5:7b-instruct
```

Ollama normally starts its service automatically; otherwise run `ollama serve`. The default endpoint is `http://127.0.0.1:11434`. Pulling the model requires internet access and running it requires sufficient local memory. You can select another installed model with `SCIAI_OLLAMA_MODEL`. The server accepts only plain HTTP loopback URLs in `SCIAI_OLLAMA_URL` (no remote Ollama endpoints). Ollama needs no API key. Its configured status does not prove that the service or model is available: connection failures and missing models are reported as unavailable, not replaced with invented output.

Optional cloud provider keys are server-only secrets:

- `GEMINI_API_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

Never expose provider keys through `VITE_*` variables, frontend code, browser storage, rendered HTML, query strings, or public capability endpoints. AI routes remain protected by `SCIAI_API_TOKEN`; public upload mode does not make AI routes public.

Local-first routing is configured with:

```env
SCIAI_OLLAMA_ENABLED="true"
SCIAI_OLLAMA_URL="http://127.0.0.1:11434"
SCIAI_OLLAMA_MODEL="qwen2.5:7b-instruct"
SCIAI_OLLAMA_TIMEOUT_MS="180000"
SCIAI_AI_DEFAULT_PROVIDER="ollama"
SCIAI_AI_PROVIDER_ORDER="ollama,gemini,claude,openai"
SCIAI_AI_ALLOW_FALLBACK="true"
SCIAI_GEMINI_MODEL="gemini-flash-latest"
SCIAI_CLAUDE_MODEL="claude-opus-5"
SCIAI_OPENAI_MODEL="gpt-4.1-mini"
```

Cloud providers are optional. If a cloud key is set and fallback is allowed, an Ollama failure can send the research prompt to that cloud provider; disable fallback in the AI selector or set `SCIAI_AI_ALLOW_FALLBACK="false"` to keep requests local. Without cloud keys, the unavailable state is returned if Ollama cannot respond. The `render.yaml` deployment explicitly selects Gemini/cloud providers rather than local Ollama, which is normally unavailable in hosted deployments.

Protected AI responses include `ai_provenance` with the provider/model used, attempted fallback path, timestamp, and limitations explaining that AI output is interpretive only.

The AI workspace also provides an in-memory provider selector with `Server default`, Ollama (local), Gemini, Claude, and OpenAI choices plus an optional fallback toggle. `Server default` follows the deployment configuration above; the selector only sends the chosen provider preference to protected AI routes. Provider keys and local settings remain server-managed and are never sent to or stored in the browser.

## Power BI Research Intelligence export

The existing `/api/powerbi/feed/:dataset_id` and `/api/powerbi/tables/:table_name` JSON Web feeds remain available for bibliometric imports. They are **not** OData, streaming, or DirectQuery. Use Power BI Desktop Web Import and refresh the import explicitly after a new SciAI dataset version is created. Pass `version_id` to pin a bibliometric version; a nonexistent dataset or unrelated version returns 404. The PBIDS file contains a URL, never credentials, and its download requires authentication. `APP_URL` must be a trusted HTTPS origin on hosted deployments; do not derive connector URLs from request Host headers.

The separate `/api/powerbi/v2` routes support **operator-declared aggregate** organizational and external reference snapshots on a private, single-operator loopback installation:

- `POST /sources`: register an immutable source with `name`, `owner`, `description`, optional `license`, `kind` (`internal_aggregate` or `external_reference`), `provenance` (`publisher`, `dataset`, `reference`), `aggregateOnly: true`, and approved `columns` (`name`, `type`, `role`). Internal tables require a numeric `group_size` column and every row must represent at least five observations.
- `POST /sources/:id/snapshots`: submit `{ "format": "csv", "content": "...", "asOf": "YYYY-MM-DD" }` (JSON row arrays are also accepted). Each import creates an immutable, numbered snapshot with a canonical content hash and provenance. The limit is 1 MiB, 5,000 rows, and 24 columns. CSV headers/JSON fields must exactly match the approved schema. Invalid imports leave no partial snapshot.
- `GET /sources`, `GET /sources/:id/snapshots`, `GET /manifest/:snapshot_id`, and `GET /tables/:snapshot_id?offset=0&limit=100`: authenticated catalog, schema manifest, and stable paginated table data. Follow `next_offset` until null. Sources are independent of bibliometric datasets; **no inferred joins** are provided. Validate a shared key before combining tables in Power BI.

These routes require the existing token guard **and** an explicit local development setup (`HOST` loopback, `SCIAI_DEV_AUTH_BYPASS="true"`, no configured API token, no public uploads). A valid shared API token alone cannot enable v2 routes; hosted access and Power BI Service refresh are unsupported. Never expose a local-bypass server through a reverse proxy or tunnel: a loopback bind address cannot prove the installation is private. Source category, provenance, `aggregateOnly`, and column approval are operator assertions; basic PII checks and minimum group sizes cannot certify privacy or prevent deliberate misclassification. Import only non-sensitive aggregates. Individual HR, student, patient, financial/personnel identifiers, confidential notes, and sensitive data are **not supported**. A multi-user deployment needs identity, per-source authorization, auditing, retention, and a credential-aware gateway before organizational connectors can be enabled. Use Anonymous Web Import only on that private local server; never put credentials in PBIDS, M scripts, URLs, or browser storage.

The opt-in `/api/powerbi/v3` routes build a **pinned combined evidence model** on top of v2 snapshots. They remain local-only under the same guards and are not hosted organizational connectors:

- `POST/GET /profiles` and `POST/GET /mappings` create immutable, versioned aggregate contracts. A mapping explicitly declares one approved dimension, one bibliometric group field (`publication_year`, `country`, `journal_source`, or `keyword`), and deterministic normalization.
- `POST /combined-models` requires `dataset_id`, `dataset_version_id`, `snapshot_id`, `profile_id`, and `mapping_id`; it never selects a latest or unrelated version. The server validates source ownership, rejects duplicate aggregate keys, materializes only matched aggregate groups, and persists the model hash, input hashes, coverage, limitations, and evidence records.
- `GET /combined-models/:id`, `/manifest`, `/evidence`, and `/tables/combined_aggregate` expose the immutable model and bounded rows. `POST /combined-models/:id/refresh` records a deterministic inspection run only; it does not fetch URLs or mutate research data. Refresh status is a durable local record, not Power BI Service scheduling.

The combined model reports unmatched groups explicitly and preserves `available`, `not_collected`, `not_applicable`, and `unavailable` coverage states. It does not infer person-, author-, document-, student-, or patient-level relationships, and an evidence metric is not a causal claim. The Power BI Studio's **Combined Evidence Model** tab provides the same profile/mapping/build workflow. Real CRIS/HR/funding connectors, tenant authorization, and hosted refresh require a separate identity and governance implementation.


## Upload API

- Health check: `GET /api/health`
- Dataset upload: `POST /api/datasets/upload`
- Sample cohort: `POST /api/datasets/load-sample-cohort`

Uploads use browser-generated multipart `FormData`; do not manually set the multipart `Content-Type` boundary. The server enforces bounded temporary-file upload limits: 25 MB per file, 50 MB per request, and up to 10 files.

When `SCIAI_PUBLIC_UPLOADS="true"`, unauthenticated browser uploads are accepted only for the upload endpoint and only from the configured public origin. Public uploads use the same file validation and upload-size limits plus a lightweight in-memory IP rate limit. Public uploads write into the shared SciAI dataset store, so do not use this mode for private per-user data until real user accounts and per-user authorization exist.

## Render deployment

This repository includes `render.yaml` for Render Blueprint deployment. It builds with `npm install && npm run build` and starts with `npm start`. Render should provide `PORT`; the blueprint sets `HOST=0.0.0.0`, `NODE_ENV=production`, `SCIAI_PUBLIC_UPLOADS=true`, and generates a private `SCIAI_API_TOKEN`.

After Render creates the service URL, set `SCIAI_PUBLIC_ORIGIN` to that exact origin, for example `https://your-service.onrender.com`, then redeploy. If Render provides `RENDER_EXTERNAL_URL`, SciAI can use it as a fallback public-upload origin.

Example server-to-server upload shape:

```bash
curl -H "Authorization: Bearer $SCIAI_API_TOKEN" -F "files=@sample.csv" -F "merge_on_upload=true" http://localhost:3000/api/datasets/upload
```

This example is for trusted server-side/admin use only. Do not copy this token into frontend code.

## Diagnosing 401/403 upload failures

If browser upload shows `Authentication required`:

1. Open the browser Network panel and inspect the failing request URL.
2. Confirm `GET /api/health` works from the same origin.
3. Confirm the request is going to the intended SciAI API, not a preview gateway or stale deployment.
4. If `SCIAI_API_TOKEN` is configured, browser mutations will return 401/403 unless a trusted gateway or real browser auth/session is deployed.
5. Do not fix this by exposing the server token to the browser.

## Verification

```bash
npm test
```

```bash
npm run lint
```

```bash
npm run build
```
