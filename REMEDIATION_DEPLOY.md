Security/performance remediation release

This release preserves nationwide discovery of approved sentinels for approved shelters, government accounts and administrators. `/sentinels` provides search, paging, list/map views, contact details, certification, species experience, facilities and current enclosure availability. `/behoerde/network` remains a working alias. Government custody-write permissions remain scoped to jurisdiction. Private KYC records, birth dates and reviewer notes are excluded from the staff directory.

Apply the database, edge functions and client together in a maintenance window: the new client requires the new RPCs, and the old client's raw application-directory queries stop working once their broad policies are removed.

1. On an existing installation through 00037, run only `external-supabase/migrations/00038_review_remediation.sql`. Do not replay 00001 on a populated database. Fresh installations should run 00001–00038 in order; 00003's invalid sequence grant and 00037's optional-function dependency have also been repaired. Run `external-supabase/smoke-test.sql` afterwards.

2. Redeploy `delete-account`, `submit-sentinel-application` and `send-application-confirmation`. Deploy the new `retry-application-confirmations` function. Keep the existing `kyc-upload` and `set-user-role` functions. Disable the Supabase gateway's JWT verification for these functions as in the existing Clerk setup; they verify the Clerk token or, for the scheduled worker, a dedicated server secret themselves. See [Supabase function configuration](https://supabase.com/docs/guides/functions/function-configuration).

3. Set a randomly generated `CRON_SECRET` in Edge Function secrets. The retry function also needs the existing `BREVO_API_KEY`, `EMAIL_FROM`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Store the same cron secret in Supabase Vault as `exog_confirmation_cron_secret` and the project URL as `exog_project_url`, using the Dashboard. Neither value belongs in a `VITE_` variable or committed config.

4. Enable `pg_cron` and `pg_net`, then run `external-supabase/schedule-confirmations.sql` as an operator. It schedules a POST every five minutes, following Supabase's [scheduled-function workflow](https://supabase.com/docs/guides/functions/schedule-functions). The worker rejects anonymous requests, claims due rows with a 15-minute lease, and retries failures without discarding the application. Delivery is at least once: if the provider accepts a message but its acknowledgement is lost, a retry may deliver a duplicate. A missing email-provider configuration leaves submissions safely queued.

5. Build and publish the client using the existing VPS deployment process. `npm run dev` now binds localhost by default; use `npm run dev -- --host 0.0.0.0` explicitly when LAN testing is needed.

6. Verify with test accounts: a shelter and a government account can both discover approved sentinels outside their own region, search by species/place/name, and see contact/facility details; an ordinary account cannot access the directory. Exercise request submission, acceptance, hiding, withdrawal and reapplication; a pending address change can be cancelled and an approved one cannot. Confirm an application survives a simulated email outage and is later delivered by the worker. On a disposable account with reviewed applications, confirm deletion completes and its audit rows remain detached.

The migration resets unreviewed application tiers to S1. Existing approved S4 grants are preserved because the database cannot distinguish an intentional historical grant from an applicant-supplied tier. Review those grants against your certification records if the old direct-insert endpoint was previously used.

Local validation commands:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test
npm run test:db
npm run test:edge
npm run test:animation
npm run build
npm run test:bundle
npm audit
```

The database regression test replays every migration on local PostgreSQL/PGlite with Supabase auth/storage schema stubs, verifies role access and workflow transitions, and injects a deletion failure to prove transaction rollback. Edge tests execute the actual function handlers with signed test JWTs and mocked external services. These tests do not change live Supabase, Clerk, Brevo or VPS state.

Verified locally on 2026-11-06: all 20 app tests, database replay/authorization tests, edge-function tests, animation cleanup, type checking and production build passed. ESLint reports zero errors and five existing component Fast Refresh warnings. `npm audit --json` reports zero known vulnerabilities. The public entry and landing page's static JavaScript dependency graph totals 147.59 kB gzip and excludes Clerk, Supabase and PDF/export libraries. The separately loaded PixelBlast animation still produces Vite's large-chunk warning; its renderer now stops and disposes on unmount. These are local regression and bundle checks, not a production load test or full browser test.

Changes cover all review findings: explicit triage discovery, server-only application creation, transactional/retryable account deletion, protected request decisions and identities, atomic address review, protected profile jurisdiction, animation cleanup, lazy optional bundles, cursor-based care-log pages with full export, durable email retries, fresh migration replay, and patched dependencies. The targeted minimatch override applies only to typescript-eslint's parser dependency; lint and type checking validate that tooling path.
