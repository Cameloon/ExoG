# Deploy — daew.pro VPS + external Supabase/Clerk

Companion to `SETUP.md`. This file is the **server side** plus the corrections
to `SETUP.md` found in the 2026-09 audit. VPS conventions (ports, units,
backups, verify-through-nginx) follow the ops guide for the Hetzner box.

Assumed hostname below: **`exog.daew.pro`**. If you pick another, change it in
exactly three places: `deploy/nginx.conf` (`server_name`, cert paths), the
Clerk allowed-origins/domain list, and the edge function secret `APP_ORIGIN`.

## What runs where

| Piece | Where |
|---|---|
| React SPA (static build) | VPS, `/var/www/exog/`, served by nginx |
| Database, RLS, file storage | Supabase (SaaS, EU region) |
| Auth, sessions, roles | Clerk (SaaS) |
| 5 edge functions | Supabase |

This app is **static-only on the box** — no app port, no systemd unit, no
hardening drop-in, no `/var/lib` data dir, no `.env` on the server. Nothing to
add to UFW (only 80/443 are used; the browser talks to Supabase/Clerk, the VPS
never does). **Do not self-host Supabase here** — you would take over TLS,
Postgres patching, GoTrue and storage at once.

---

## 0. Before you start

- [ ] DNS: `A exog.daew.pro → 167.233.163.136` (Hetzner DNS or wherever
      `daew.pro` is managed). Verify: `dig +short exog.daew.pro`.
- [ ] Build machine: Node 20+ and this repo.

## 1. Supabase

- [ ] Create the project in **eu-central-1** or **eu-west-1** (your
      `docs/08_Cloud_C5_Hosting.md` claims EU processing).
- [ ] Migrations: on a **fresh** project run `external-supabase/migrations/00001…00037.sql`
      in filename order, then `smoke-test.sql` — every block must return `ok`.

> ⚠️ **`SETUP.md` §3 said "each file is idempotent, so re-running one is safe". That was false**
> (now corrected there too). `00001_init.sql` does `drop table … cascade` on
> `profiles`, `user_roles`, `sentinel_applications`, `application_documents`
> and `application_audit_log`. Re-running it on a project with data **deletes
> every application, KYC row and audit entry.** On a project that already has
> data, apply only the migrations that are actually missing, one at a time.

- [ ] Migration drift check — the audit found the current live project is
      missing **`00036_shelter_directory_invoker.sql`**: `shelter_contacts`
      does not exist, so a shelter's address/contact/exact coordinates never
      persist (the editor errors on save) and its map pin stays on the rounded
      fallback coords. Supabase's advisor also reports the view as
      `SECURITY DEFINER` — the exact finding 00036 fixes. Verify and fix:
      ```bash
      curl -s "https://<ref>.supabase.co/rest/v1/shelter_contacts?select=id&limit=1" \
           -H "apikey: <publishable-key>"
      # 200 []       = applied
      # 404 PGRST205 = not applied → paste 00036 into the SQL editor
      ```
- [ ] Seed the reference table (it is empty right now — the species picker
      shows nothing):
      ```bash
      SUPABASE_SECRET_KEY="sb_secret_…" node scripts/seed-cites.mjs
      ```
      The secret key is server-side only: never in `.env` (that file holds
      `VITE_` values, which get compiled into the public JS), never committed.
- [ ] Seed example animals for the live pipeline test (one account walks the
      whole sentinel flow — approved S4 application, 3 wards in different
      states, a valid care-log hash chain, duties, an open identification
      request):
      ```bash
      node scripts/seed-example-wards.mjs --dry-run                 # plan + self-check
      SUPABASE_SECRET_KEY="sb_secret_…" node scripts/seed-example-wards.mjs \
        --user user_XXXXXXXX --name "Dr. Demo" --email demo@example.de --region BY
      ```
      Get the `user_…` id from Clerk → Users. Re-running reseeds the demo
      wards' care logs/duties (only `EX-DEMO-*`).
- [ ] Turn on database backups / PITR (`docs/05_Backup_Wiederherstellung.md`).
- [ ] Free plan only: the project **auto-pauses after ~1 week idle**, which
      took the site down and looked identical to a deleted project (DNS
      NXDOMAIN). Pro is the real fix; otherwise keepalive + uptime check:
      ```cron
      # /etc/cron.d/supabase-keepalive
      0 6 * * * root curl -s -o /dev/null https://<ref>.supabase.co/auth/v1/health -H "apikey: <publishable-key>"
      ```
- [ ] Collect from the dashboard: project URL, **publishable** key
      (Settings → API) and **secret** key (Settings → API Keys; for the edge
      functions and the seed only).

## 2. Clerk

- [ ] Create a **production** instance. The repo currently points at a
      development instance (`pk_test_…`, `ideal-tetra-26.clerk.accounts.dev`)
      → "development mode" banner, dev limits.
- [ ] Clerk will give you CNAME records for a domain you own (typically
      `clerk.daew.pro` / `accounts.daew.pro`) — add them at your DNS provider,
      wait for the check, then note the frontend API host for the CSP.
- [ ] JWT template named exactly **`supabase`**, signing key = Supabase JWT
      secret, with claims (see `00010_has_role_jwt.sql`):
      - top-level `role` = `authenticated` — Supabase uses it to pick the
        Postgres role. Setting it to `admin` either errors or bypasses RLS.
      - custom `app_role` = `{{user.public_metadata.role}}` — what the DB's
        `has_role()` trusts.
      - `region` = `{{user.public_metadata.region}}` for authority scoping.
- [ ] Add the Clerk production host to the CSP in **`public/_headers`,
      `deploy/nginx.conf` and `index.html`** (`script-src`, `connect-src`,
      `frame-src`) — otherwise the sign-in bundle is blocked with a console
      error and nothing else.
- [ ] Bootstrap the first admin: sign up, then in the SQL editor
      ```sql
      insert into public.user_roles (user_id, role)
      values ('user_XXXXXXXX', 'admin')
      on conflict do nothing;
      ```
      Sign out and in; `/admin` appears. Use the admin UI (`set-user-role`)
      for further role changes.
- [ ] MFA on the Clerk dashboard account. Whoever controls the JWT template
      controls what `app_role` the database trusts — i.e. DB admin.

## 3. Edge functions

- [ ] Deploy all five from `external-supabase/functions/` (dashboard or CLI,
      `--no-verify-jwt`; each verifies the Clerk token itself).
- [ ] Secrets (shared):

      | Secret | Value |
      |---|---|
      | `APP_ORIGIN` | `https://exog.daew.pro` — **exact origin, no trailing slash**, else browser CORS failures |
      | `CLERK_DOMAIN` | Clerk frontend API host, e.g. `clerk.daew.pro` |
      | `CLERK_SECRET_KEY` | Clerk `sk_…` |
      | `SUPABASE_URL` | project URL |
      | `SUPABASE_SERVICE_ROLE_KEY` | service-role / secret key |
      | `BREVO_API_KEY` | optional; unset = confirmation mails are only logged |
      | `EMAIL_FROM` | verified Brevo sender |

- [ ] Set `CLERK_DOMAIN` explicitly — it is now **required**. The hardcoded
      dev-domain fallback was removed in the 2026-09 security pass: without the
      secret, every function answers
      `503 {"error":"function not configured"}` instead of silently verifying
      tokens against a Clerk instance you no longer control. Set the secret
      *before* redeploying, or the functions go dark (loudly, by design).
- [ ] Check:
      ```bash
      curl -s -o /dev/null -w '%{http_code}\n' -X POST \
        "https://<ref>.supabase.co/functions/v1/kyc-upload" \
        -H "apikey: <publishable-key>" -H 'content-type: application/json' -d '{}'
      # 401 = deployed, rejecting anonymous calls (correct)  404 = not deployed
      ```

## 4. App config

- [ ] Update the `FALLBACK` block in `src/config/external.ts` (or a local
      `.env`) with the new `SUPABASE_URL`, publishable key,
      `CLERK_PUBLISHABLE_KEY` (`pk_live_…`), `CLERK_SUPABASE_JWT_TEMPLATE=supabase`.
- [ ] These are **build-time** values — `.env` on the VPS does nothing, you must
      rebuild. Publishable keys in a public repo are fine; a secret key in
      `.env` is not. Anything prefixed `VITE_` is compiled into public JS.

## 5. Build + ship to the VPS

```bash
# local
npm ci
npm run build                                   # NOT build:dev (ships dev instrumentation)

SSH="ssh -i ~/.ssh/id_hetzner root@167.233.163.136"

# VPS: first-time only
$SSH 'mkdir -p /var/www/exog && chown d4n:d4n /var/www/exog'

# rollback copy, then sync (keep the *.bak-YYYYMMDD convention)
$SSH 'test -d /var/www/exog && cp -a /var/www/exog /var/www/exog.bak-$(date +%Y%m%d) || true'
rsync -az --delete dist/ d4n@167.233.163.136:/var/www/exog/
```

Deploy parity (VPS guide §7) — compare the hashed asset names, not just a 200:

```bash
ls dist/assets/ | head -1                                   # local
$SSH 'ls /var/www/exog/assets/ | head -1'                   # deployed — must match
```

## 6. nginx

```bash
$SSH 'cp -a /etc/nginx/sites-available/portfolio /etc/nginx/sites-available/portfolio.bak-$(date +%Y%m%d)'   # untouched, just in case

scp -i ~/.ssh/id_hetzner deploy/nginx.conf root@167.233.163.136:/etc/nginx/sites-available/exog
$SSH 'ln -sf /etc/nginx/sites-available/exog /etc/nginx/sites-enabled/exog'

# TLS for the new subdomain (Certbot rewrites the vhost and adds its managed lines)
$SSH 'certbot --nginx -d exog.daew.pro --redirect'

$SSH 'nginx -t && systemctl reload nginx'      # never restart
```

No `limit_req` zone is added for this vhost: it serves static files only, there
is no CPU-heavy endpoint to protect. If bandwidth abuse ever becomes a concern,
one zone from `/etc/nginx/conf.d/ratelimit.conf` is enough.

## 7. Verify

```bash
D=https://exog.daew.pro
curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' "$D/"            # 200
curl -s -o /dev/null -w '%{http_code}\n' "$D/dashboard"                  # 200, SPA fallback
curl -sD - -o /dev/null "$D/" | grep -iE 'content-security-policy|strict-transport|x-frame|frozen'
$SSH 'journalctl -u nginx --since "5 min ago" -p warning --no-pager'
```

- [ ] CSP header present **and without `script-src 'unsafe-inline'`** (proves
      nginx's header wins over the meta fallback).
- [ ] RLS still denies anonymous:
      ```bash
      for t in profiles user_roles sentinel_applications ward_listings shelters; do
        printf '%-24s ' "$t"
        curl -s "https://<ref>.supabase.co/rest/v1/$t?select=*&limit=1" \
             -H "apikey: <publishable-key>" | head -c 60; echo
      done        # must print [] or a permission error, never rows
      ```
- [ ] Browser console: no CSP violations, no Clerk "development mode" warning.
- [ ] Full flow smoke test: sign up → submit an application → upload KYC →
      promote yourself to admin → open a document → delete a test account.
      That exercises all five edge functions.
- [ ] Sentinel pipeline walk (seeded above): sign in as the seeded user →
      `/dashboard` shows the 3 wards + care logs + duties → care-log entry via
      the composer (DB-side hash chain) → `EX-DEMO-003` visible in the vetted
      wards list → Bestimmungshilfe tab: vote on the open identification
      request → documents export shows "KONFORM" for the seeded logs.
      Behörde/shelter side (ward creation, assignment, interest decision)
      needs a second account with the `behoerde` role + region set.
- [ ] `summary.md`: this file plus `SETUP.md` are the app's summary. If the box
      convention wants one on the server, drop a `summary.md` (2–3 lines:
      static SPA, vhost `exog`, no unit, rollback = restore `.bak`) next to
      `/var/www/exog/`.

## 8. Known ceilings (documented, not bugs)

- Edge function rate limiting is in-memory per instance — resets on cold start,
  not shared across workers. Fine at low volume; put Cloudflare Turnstile in
  front of the public application form (already allowed in the CSP) if abused.
- `has_role()` trusts the `app_role` claim from the Clerk JWT template, so the
  Clerk account is the root of trust for DB admin.
- Client-side role checks (`isAdmin`, `isBehoerde`) only control UI; every read
  and write is decided by RLS. Do not move authorization into React.
- A `.env` was committed to git history once (a now-**revoked** Supabase secret
  key — gateway answers "Unregistered API key"). Purge it
  (`git filter-repo --path .env --invert-paths`) and enable GitHub secret
  scanning so it cannot recur.
