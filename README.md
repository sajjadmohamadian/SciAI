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

SciAI includes two browser account roles: **administrator** and **user**. Both use an HttpOnly session cookie, not a server API token. Administrators can create accounts, change roles, disable/restore access, remove access (soft deletion), and issue expiring password-reset tokens. Ordinary users cannot call administration endpoints. All authenticated users currently work in **one shared research workspace**: this is role-based account management, not private per-user datasets, source ACLs, or tenant isolation.

### First administrator and login

Supply `SCIAI_BOOTSTRAP_ADMIN_EMAIL` and `SCIAI_BOOTSTRAP_ADMIN_PASSWORD` to the **server process** before starting the app. Use a unique 12–256-character password from a password manager. No known administrator password is seeded. Bootstrap runs only against an empty account store and never overwrites an existing account. First sign-in forces a password change; remove the bootstrap environment secret afterward. `.env.example` documents the names, but deployment environment configuration must actually supply them to Node.

- `GET /api/auth/me`, `POST /api/auth/login`, `/logout`, `/password`, and `/reset` implement browser sessions and password changes/resets.
- Session lifetime is eight hours. Session and reset credentials are stored only as domain-separated SHA-256 hashes; passwords use asynchronously computed, randomly salted scrypt hashes. Cookie flags are HttpOnly, SameSite=Lax and Secure in production; production **requires HTTPS**, a trusted exact `APP_URL`, and a persistent SQLite volume.
- All research API paths and legacy aliases require a valid session or explicitly validated integration token, including reads. Cookie-authenticated mutations require a session-bound `X-CSRF-Token` and allowed Origin/Fetch-Metadata. The UI holds CSRF state in memory only. Logout, disabling/removing an account, role changes and password resets revoke sessions.
- Accounts created by administrators must change their initial password. Reset tokens expire after one hour, are single-use, are shown once to the administrator, and must be delivered privately. Issuing a reset immediately invalidates the old password and sessions; only token redemption restores password login. No email provider or public registration is configured. Resetting a password does not enable a disabled account.
- The last active administrator cannot be disabled/demoted; administrators cannot remove their own access from the administration UI/API. Soft deletion retains account identity and append-only audit history; it is not data erasure. Audit records omit passwords and credentials.
- Authentication endpoints apply bounded per-socket-address attempt limits (20 attempts per 15 minutes). Forwarded IP headers are not trusted. Deploy a trusted gateway with additional rate limiting for internet exposure; multiple users behind one proxy share the application limit. TLS termination and proxy trust must be configured by the operator.
- `SCIAI_USER_AUTH_ENABLED=false` is a **loopback-only legacy development/test option**. It is ignored on non-loopback hosts. The older `SCIAI_DEV_AUTH_BYPASS` does not bypass enabled browser authentication, and public-upload mode does not override the login requirement.
- `SCIAI_API_TOKEN`/`API_TOKEN` remain optional privileged server-to-server integration credentials. They do not grant account-administration access. Never expose them in `VITE_*`, browser storage, URLs, PBIDS, or scripts. API tokens are not browser login credentials.

Power BI v2/v3 aggregate APIs retain their stricter private loopback/no-shared-token/no-public-upload boundary and additionally require an administrator session when user login is enabled. Login does **not** enable hosted organizational exports or Power BI Service refresh. Existing Anonymous Power Query/PBIDS instructions apply only to explicit local legacy mode; Power BI Desktop does not share the browser login cookie. With login enabled, use the authorized in-app file exports until a separate credential-aware Power BI connector is implemented.

No commit should contain real bootstrap passwords, production database files, session tokens, or reset tokens.

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

Never expose provider keys through `VITE_*` variables, frontend code, browser storage, rendered HTML, query strings, or public capability endpoints. AI routes require an authenticated session (with CSRF for mutations) or a validated server-side integration token; public upload mode never makes AI routes public.

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


## Contextual exports across studios

Every studio has an **Export an output from this tab** selector for its displayed tables, SVG figures, and preformatted results. No analysis from another tab or dataset is silently substituted. Displayed-output exports contain only displayed rows/labels (including filters and pagination), explicitly marked in provenance; a figure's labels are not its underlying dataset. SVG/PNG/JPG exports capture the actual selected SVG and computed styles. Maps rendered as SVG use the same image path; canvas/raster map capture is not supported.

Analysis result panels additionally export the complete computed records, scalar metrics, parameters, and analysis/dataset-version identifiers. Network Studio exports its computed topology as Pajek `.net`, GEXF, or GraphML as well as figures. Power BI table exports include all loaded rows with feed version metadata; aggregate snapshot exports paginate the complete pinned snapshot, and combined model exports retain their manifest and evidence.

Formats are CSV, JSON, LaTeX, native OOXML Word `.docx`, Excel `.xlsx`, PowerPoint `.pptx`, and browser print (**Save as PDF**). Office files are dependency-free ZIP/XML data snapshots, not renamed HTML; they retain provenance, rows, metadata, and optional graph data. They do not contain native editable charts or embedded figure images; use the image actions for figures. Office limits reject excessive inputs with an error rather than truncating. Missing/null cells are distinct, and formula-looking spreadsheet values stay text. PDF opens a print dialog; it is not an automatic PDF-file download. Legacy corpus report endpoints retain their existing compatibility formats.

## Upload API


- Health check: `GET /api/health`
- Dataset upload: `POST /api/datasets/upload`
- Sample cohort: `POST /api/datasets/load-sample-cohort`

Uploads use browser-generated multipart `FormData`; do not manually set the multipart `Content-Type` boundary. The server enforces bounded temporary-file upload limits: 25 MB per file, 50 MB per request, and up to 10 files.

With default user authentication, uploads require a logged-in session or validated integration token regardless of `SCIAI_PUBLIC_UPLOADS`. The old public-upload behavior is retained only when user authentication is explicitly disabled in local legacy development. Public-upload mode writes to the same shared workspace and must never be used as per-user data isolation.

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
4. Sign in and complete any required password change. If the session expired, sign in again. For hosted use, verify HTTPS and trusted `APP_URL`; API tokens remain server-to-server credentials, not browser passwords.
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
