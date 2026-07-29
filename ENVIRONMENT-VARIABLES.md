# Environment-variable inventory

Week 8 baseline: 2026-07-28. Values shown here are non-secret examples. Runtime values belong in
the deployment platform's environment store; local overrides belong in ignored `.env.local`.
Run `pnpm config:check` before starting or building either app. It reports variable names and safe
mode labels only—never values.

Owner abbreviations: **App** = application engineering, **Platform** = hosting/database owner,
**Security** = secrets owner, **Identity** = Auth/UAE PASS owner, **Comms** = email owner.

## Application and deployment

| Name                            | Req.            | Environments | Exposure | Secret | Safe example            | Source             | Used by                     | Missing/invalid behavior                      | Local default           | Staging owner | Production owner |
| ------------------------------- | --------------- | ------------ | -------- | ------ | ----------------------- | ------------------ | --------------------------- | --------------------------------------------- | ----------------------- | ------------- | ---------------- |
| `NEXT_PUBLIC_WEB_URL`           | Required        | All          | Client   | No     | `http://localhost:3000` | App/hosting config | Web, Auth redirects, CORS   | Startup/build fails; HTTPS required off local | `http://localhost:3000` | Platform      | Platform         |
| `NEXT_PUBLIC_ADMIN_URL`         | Required        | All          | Client   | No     | `http://localhost:3001` | App/hosting config | Admin, Auth redirects, CORS | Startup/build fails; must differ from web     | `http://localhost:3001` | Platform      | Platform         |
| `NEXT_PUBLIC_DEFAULT_LOCALE`    | Required        | All          | Client   | No     | `en`                    | App config         | Web/Admin i18n              | Startup/build fails unless `en` or `ar`       | `en`                    | App           | App              |
| `NEXT_PUBLIC_SUPPORTED_LOCALES` | Required        | All          | Client   | No     | `en,ar`                 | App config         | Web/Admin i18n              | Startup/build fails unless both locales exist | `en,ar`                 | App           | App              |
| `DEMO_ENVIRONMENT`              | Required policy | All          | Server   | No     | `staging`               | Deployment config  | Config/security headers     | Defaults to `local`; invalid value fails      | `local`                 | Platform      | Platform         |
| `NODE_ENV`                      | Platform        | All          | Server   | No     | `production`            | Node/Next          | Framework/build             | Framework default applies                     | Tool-managed            | Platform      | Platform         |
| `ANALYZE`                       | Optional        | Local/CI     | Server   | No     | `false`                 | Operator           | Bundle analyzer             | Analyzer remains disabled                     | `false`                 | App           | N/A              |
| `CI`                            | Platform        | CI           | Server   | No     | `true`                  | CI runner          | Test/build tools            | Local behavior                                | Unset                   | Platform      | N/A              |
| `PLAYWRIGHT_NO_SERVER`          | Optional        | Local/CI     | Server   | No     | `false`                 | Test operator      | Playwright configs          | Playwright starts configured servers          | `false`                 | QA            | N/A              |

## Supabase, database, Auth, Storage, and email

| Name                            | Req.          | Environments     | Exposure | Secret   | Safe example                                              | Source            | Used by                         | Missing/invalid behavior                                       | Local default                     | Staging owner | Production owner |
| ------------------------------- | ------------- | ---------------- | -------- | -------- | --------------------------------------------------------- | ----------------- | ------------------------------- | -------------------------------------------------------------- | --------------------------------- | ------------- | ---------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Required      | All              | Client   | No       | `http://127.0.0.1:54321`                                  | Supabase/platform | Browser/server Supabase clients | Startup/build fails; HTTPS off local                           | CLI API URL                       | Platform      | Platform         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required      | All              | Client   | No       | `replace-with-publishable-key`                            | Supabase          | Browser Supabase clients        | Startup/build fails; secret/service key rejected               | CLI publishable/anon key          | Platform      | Platform         |
| `SUPABASE_URL`                  | Test only     | CI/local         | Server   | No       | `http://127.0.0.1:54321`                                  | Supabase CLI      | Integration helpers             | Helpers use public URL or skip                                 | CLI API URL                       | QA            | N/A              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Required      | All              | Server   | Yes      | `replace-with-service-role-key`                           | Supabase secrets  | Trusted Storage/Admin setup     | Startup/build fails; publishable key rejected                  | CLI legacy `SERVICE_ROLE_KEY` JWT | Security      | Security         |
| `DATABASE_URL`                  | Required      | All              | Server   | Yes      | `postgresql://app:password@db.example:6543/app`           | Database secret   | App queries/tRPC                | Startup/build fails                                            | Local Postgres `:54322`           | Platform      | Platform         |
| `DIRECT_DATABASE_URL`           | Required      | All              | Server   | Yes      | `postgresql://owner:password@db.example:5432/app`         | Database secret   | Migration/admin/Realtime ops    | Startup/build fails; must differ from pooled URL in production | Same local DB; direct port        | Platform      | Platform         |
| `TEST_DATABASE_URL`             | Test only     | CI/local         | Server   | Yes      | `postgresql://postgres:password@127.0.0.1:54322/postgres` | Supabase CLI      | Destructive integration tests   | Tests explicitly skip/fail gate if absent                      | Local DB URL                      | QA            | N/A              |
| `BOOTSTRAP_ADMIN_EMAIL`         | Optional pair | Controlled setup | Server   | Personal | `ops@example.invalid`                                     | Release owner     | `pnpm db:setup`                 | Setup is a no-op if pair absent; partial pair fails            | Unset                             | Release owner | Release owner    |
| `BOOTSTRAP_ADMIN_PASSWORD`      | Optional pair | Controlled setup | Server   | Yes      | `generated-in-secret-manager`                             | Security          | `pnpm db:setup`                 | Same as above                                                  | Unset                             | Security      | Security         |
| `BOOTSTRAP_ADMIN_NAME`          | Optional      | Controlled setup | Server   | No       | `MARKAZ Operations`                                       | Release owner     | Admin bootstrap                 | Defaults to `MARKAZ Operations`                                | Default in setup script           | Release owner | Release owner    |

Supabase Auth site URL, allowed redirect URLs, SMTP sender, JWT/session settings, rate limits,
Storage bucket settings, and email templates are provider-side configuration—not environment
variables in this repository. Their owners and verification steps are in
`docs/runbooks/auth-readiness.md`, `storage-readiness.md`, and `email-readiness.md`.

## Prototype boundaries and external adapters

| Name                          | Req.            | Environments      | Exposure | Secret   | Safe example               | Source             | Used by                  | Missing/invalid behavior                                                          | Local default  | Staging owner | Production owner   |
| ----------------------------- | --------------- | ----------------- | -------- | -------- | -------------------------- | ------------------ | ------------------------ | --------------------------------------------------------------------------------- | -------------- | ------------- | ------------------ |
| `DEMO_AUTH_FALLBACK`          | Required policy | All               | Server   | No       | `false`                    | App config         | Auth boundary            | Any value except `false` fails validation                                         | `false`        | App           | App                |
| `DEMO_AUTH_ALLOWLIST`         | Dormant         | None              | Server   | Personal | `demo@example.invalid`     | App config         | Reserved ADR-0007 flag   | No effect; fallback is unimplemented                                              | Unset          | App           | N/A                |
| `UAE_PASS_MODE`               | Required mode   | All               | Server   | No       | `simulated`                | Identity config    | UAE PASS adapter         | Defaults simulated; staging requires credentials; staging forbidden in production | `simulated`    | Identity      | Identity           |
| `UAE_PASS_CLIENT_ID`          | Conditional     | Approved staging  | Server   | Yes      | `provided-by-uae-pass`     | UAE PASS           | Provider bootstrap/Auth  | Staging validation fails if absent                                                | Unset          | Identity      | Identity           |
| `UAE_PASS_CLIENT_SECRET`      | Conditional     | Approved staging  | Server   | Yes      | `stored-in-secret-manager` | UAE PASS           | Provider bootstrap/Auth  | Staging validation fails if absent                                                | Unset          | Security      | Security           |
| `UAE_PASS_ALLOW_REMOTE_SETUP` | Optional        | Staging only      | Server   | No       | `false`                    | Release owner      | Provider setup guard     | Defaults false; `true` forbidden in production                                    | `false`        | Identity      | N/A                |
| `UAE_PASS_SCOPE`              | Optional        | Staging           | Server   | No       | `openid profile email`     | UAE PASS agreement | Provider bootstrap       | Script default applies                                                            | Script default | Identity      | Identity           |
| `UAE_PASS_ACR_VALUES`         | Optional        | Staging           | Server   | No       | `urn:...:loa:...`          | UAE PASS agreement | Provider bootstrap       | Script default applies                                                            | Script default | Identity      | Identity           |
| `BAYUT_API_MODE`              | Required mode   | Local/staging     | Server   | No       | `disabled`                 | App/legal decision | Home/marketplace adapter | Defaults disabled; production rejects enabled mode                                | `disabled`     | Product/legal | Product/legal      |
| `BAYUT_API_KEY`               | Conditional     | Approved non-prod | Server   | Yes      | `stored-in-secret-manager` | RapidAPI           | Bayut adapter            | RapidAPI mode fails validation if absent                                          | Unset          | Security      | N/A until approved |

## Logging, monitoring, and error tracking

| Name              | Req.     | Environments | Exposure | Secret | Safe example | Source     | Used by         | Missing/invalid behavior                        | Local default  | Staging owner | Production owner |
| ----------------- | -------- | ------------ | -------- | ------ | ------------ | ---------- | --------------- | ----------------------------------------------- | -------------- | ------------- | ---------------- |
| `LOG_LEVEL`       | Optional | All          | Server   | No     | `info`       | Platform   | Pino logger     | Library default; invalid configured value fails | `debug`        | Platform      | Platform         |
| `SERVICE_NAME`    | Optional | All          | Server   | No     | `markaz-web` | Platform   | Structured logs | Library default; invalid identifier fails       | `markaz-local` | Platform      | Platform         |
| `SLOW_REQUEST_MS` | Optional | All          | Server   | No     | `500`        | SRE policy | API timing logs | Library default; invalid range fails            | `500`          | Platform      | Platform         |

No external monitoring or error-tracking provider variables exist. That is a deliberate, explicit
production blocker—not an empty slot to fill with invented credentials. See
`OBSERVABILITY-RUNBOOK.md`.
