# Measurement runbook

The review flagged that there is no evidence yet of real slowness (DB latency, React
rendering, bundle execution), and recommended **measuring before optimizing**. This
runbook lists the knobs now in place and how to gather that evidence.

## 1. Request timing + slow-request logging (API)

Every tRPC procedure is timed by the `logging` middleware (`packages/api/src/trpc.ts`)
and emitted through the pino logger (`@markaz/observability`):

- Normal requests → `info` with `msg: "trpc.request"` and an `ms` field.
- Requests at/above the slow threshold → `warn` with `msg: "trpc.request.slow"` and
  `slow: true`.

Knobs (env):

| Var               | Default                       | Effect                                                    |
| ----------------- | ----------------------------- | --------------------------------------------------------- |
| `SLOW_REQUEST_MS` | `500`                         | ms at/above which a request logs at WARN with `slow:true` |
| `LOG_LEVEL`       | `info` (prod) / `debug` (dev) | pino level                                                |

Find the slow ones:

```bash
# tail app logs and keep only slow requests, sorted by duration
grep '"trpc.request.slow"' app.log | jq -r '[.ms, .path] | @tsv' | sort -rn | head -20
```

## 2. Per-statement (query) timing — at the database

Per-statement timing belongs in Postgres, not in hand-rolled app instrumentation
(the review's "avoid premature abstraction in SQL"). Turn on slow-statement logging:

```sql
-- log every statement slower than 100ms (session or role scope; or set in postgresql.conf)
set log_min_duration_statement = 100;
```

- **Local (Supabase CLI):** add to `supabase/config.toml` under `[db]` or set per session
  in `psql`, then read the Postgres container logs.
- **Hosted (Supabase):** Dashboard → Database → Query Performance (uses
  `pg_stat_statements`), or set `log_min_duration_statement` in the project settings.

`pg_stat_statements` is the best aggregate view — it ranks statements by total and
mean time, so you see which query (or N+1) actually dominates before touching code.

## 3. Bundle analysis (web + admin)

`@next/bundle-analyzer` is wired into both apps, gated by `ANALYZE`:

```bash
pnpm --filter @markaz/web analyze     # ANALYZE=true next build → opens .next/analyze/*.html
pnpm --filter @markaz/admin analyze
```

It produces an interactive treemap of each route's first-load JS. Use it to confirm
the review's hypotheses before acting:

- Which routes exceed ~250–300 kB first-load JS.
- Whether the ~1,755-key `next-intl` message JSON is being shipped whole (candidate for
  per-namespace splitting).
- Heavy client components that could be `next/dynamic` lazy-loaded (complex
  dialogs/workspaces).

## 4. Load testing

No load test is committed (it needs a decision on target/scenario). A quick smoke against
the local stack, once `pnpm dev` is up and you have a signed-in session cookie:

```bash
# autocannon: 20 connections, 30s, against the public marketplace (anonymous)
npx autocannon -c 20 -d 30 http://127.0.0.1:3000/en/properties
```

For authenticated/tRPC endpoints, script the login + capture the cookie first (or drive
the SQL functions directly, as the integration tests do). Treat results as relative
signal on a dev machine, not absolute production numbers.

## What to do with the evidence

1. Turn on `log_min_duration_statement` + `pg_stat_statements`; capture the top queries
   under a representative click-through.
2. Run `analyze` on both apps; note routes over the first-load budget.
3. Only then optimize the specific hotspots — batched queries (see the
   `transactions.listMine` fix), message-namespace splitting, and `next/dynamic` for the
   heaviest client components.
