Implementation follow-up: all findings below have corresponding fixes and regression checks in the repository. Sentinel discovery follows the clarified requirement: approved shelters and government accounts can browse approved sentinels nationwide through an explicit triage directory. Deployment steps and validation commands are in [REMEDIATION_DEPLOY.md](REMEDIATION_DEPLOY.md). The original findings and user clarification are retained below as the historical review; they do not describe the remediated source. Live deployment has not been changed.

Security and performance review — 2026-11-06

The highest-priority findings are a cross-user application disclosure, applicant-controlled expert tier, and account deletion that cannot complete under the checked-in schema. Application code and dependency versions were not changed.

Scope and validation: reviewed the React client, five edge functions, migration sequence 00001–00037, deployment headers, and locked dependencies. All 15 existing tests passed; TypeScript checking passed; production build passed in 9.27 seconds; ESLint reported zero errors and six React refresh warnings. These checks do not exercise database authorization or edge functions.

Database reproductions used a temporary PGlite PostgreSQL engine with synthetic users and Supabase auth/storage schema stubs. The harness applied the migration sequence after skipping the invalid sequence grant described below and the final REVOKE for the externally defined `rls_auto_enable()` function. It modeled Supabase table grants and exercised requests as `authenticated` and `service_role`, not as the database owner. No live Supabase, Clerk, storage, or email data was accessed. Deployed migrations, identity-provider configuration, and live traffic performance remain unverified.

1. **High — Shelter owners can manufacture access to another user's private application.**

   [00006_shelters_network.sql:82](/home/highq-student/Documents/ExoG/external-supabase/migrations/00006_shelters_network.sql:82) allows a shelter owner to INSERT a `sentinel_shelter_requests` row naming any `sentinel_id`. [00024_combined_fixes.sql:159](/home/highq-student/Documents/ExoG/external-supabase/migrations/00024_combined_fixes.sql:159) then treats that relationship as permission to SELECT the target's complete `sentinel_applications` row. These policies remain in the final migration state.

   Reproduced: the shelter account initially saw zero victim rows; after inserting its own shelter ID with the victim's user ID, it could read the victim's email and questionnaire containing street address, phone and birth date. The attacker needs a shelter account and a target user ID. This does not require the target to submit a request or the attacker to be an administrator.

   Fix: allow only the sentinel to initiate a relationship, keep relationship identities immutable, and give shelter owners only the decision operation. Restrict the application fields shared with shelters through a separate projection or narrowly authorized RPC. Removing shelter INSERT alone is insufficient if owners can still rewrite another request's `sentinel_id`.
   ==🟠My two senses: But I want the shelter owners or govermental accounts to be able to see all the available sentinels! I mean it plays a crucial role for the triage when an animal gets confiscated,found or surrendered to a shelter to find a fitting sentinel that could take the animal in!==
   

2. **High — Applicants can preselect S4 expert privileges.**
   [00013_security_harden.sql:9](/home/highq-student/Documents/ExoG/external-supabase/migrations/00013_security_harden.sql:9) constrains the initial application status and KYC status but leaves other fields writable. [00021_care_and_identification.sql:26](/home/highq-student/Documents/ExoG/external-supabase/migrations/00021_care_and_identification.sql:26) adds `tier`, and `is_expert()` trusts an approved application with `tier='S4'`. The normal [admin approval:353](/home/highq-student/Documents/ExoG/src/pages/Admin.tsx:353) preserves this applicant-supplied tier; the review page has no tier control.

   Reproduced: a regular user directly inserted a pending application with `tier='S4'`; after an ordinary admin approval, `is_expert()` returned true. Admin approval is still required, but an independent expert-tier grant is bypassed. Direct database INSERT also bypasses the edge function's required documents and questionnaire validation.
   Fix: remove direct authenticated application INSERT and use the validating server endpoint, or restrict initial tier to S1 and reserve tier changes for an explicit administrative operation. Set all privileged fields server-side.

3. **High — Account deletion performs destructive work and then fails permanently.**
   There are two independent, reproduced blockers:
   - [00012_audit_harden.sql:9](/home/highq-student/Documents/ExoG/external-supabase/migrations/00012_audit_harden.sql:9) changes the audit foreign key to `ON DELETE SET NULL` but leaves `application_audit_log.application_id` NOT NULL. Deleting an application with an audit entry fails with a not-null violation.
   - [delete-account/index.ts:212](/home/highq-student/Documents/ExoG/external-supabase/functions/delete-account/index.ts:212) always updates `change_log`, while [00011_change_log.sql:24](/home/highq-student/Documents/ExoG/external-supabase/migrations/00011_change_log.sql:24) explicitly revokes UPDATE from `service_role`. PostgreSQL rejects the statement even when no rows match.
   Storage is purged before these failures, and Clerk deletion happens afterwards. A user can therefore lose files and some records while retaining their account; retries cannot resolve the schema/permission errors.
   Fix: make the audit FK nullable if detached audit records are intended, and implement a tightly scoped deletion/anonymization RPC with appropriate privileges. Validate prerequisites before irreversible file removal and track deletion progress durably.

3. **Medium — Sentinels can approve their own shelter and ward requests.**
   [00006_shelters_network.sql:95](/home/highq-student/Documents/ExoG/external-supabase/migrations/00006_shelters_network.sql:95) gives sentinels unrestricted status changes on their own shelter requests. [00002_adoption_marketplace.sql:137](/home/highq-student/Documents/ExoG/external-supabase/migrations/00002_adoption_marketplace.sql:137) permits ward-interest INSERT without requiring the initial status to be `open`.
   Reproduced an approved sentinel inserting an `accepted` shelter request and a `matched` ward request without a shelter decision. This falsifies approval state; it does not itself transfer ward ownership.
   Fix: enforce `open` on submission, allow applicants only withdrawal, and reserve acceptance/matching for the responsible shelter or administrator. Protect relationship IDs as well as status transitions.

4. **Medium — Users can forge and erase address-change review records.**
   [00027_sentinel_change_requests.sql:29](/home/highq-student/Documents/ExoG/external-supabase/migrations/00027_sentinel_change_requests.sql:29) gives owners `FOR ALL` access, constrained only by user ID. They can set `status`, `reviewed_by` and `reviewed_at`, change the requested address after review, and delete reviewed records after the later DELETE grant.
   Reproduced INSERT with `status='approved'` and a fabricated reviewer. This does not directly update the canonical application address, since the admin UI performs that separately; it compromises the approval record and queue.
   Fix: separate creation, read and pending-cancellation policies; only an administrative transaction should change review fields or apply the approved address.

5. **Medium — A new authority profile can choose its own fallback jurisdiction.**
   [00004_profile_sync.sql:8](/home/highq-student/Documents/ExoG/external-supabase/migrations/00004_profile_sync.sql:8) allows INSERT of all profile fields for the caller's ID. [00022_security_and_commands.sql:18](/home/highq-student/Documents/ExoG/external-supabase/migrations/00022_security_and_commands.sql:18) restricts UPDATE of `region` but leaves INSERT open; `current_region()` trusts the stored value when the JWT has no region.
   Reproduced a `behoerde` user without a JWT region inserting a profile with `region='Berlin'` and obtaining that jurisdiction. This requires no existing profile and a missing/empty JWT region; it does not override an assigned JWT region or grant an authority role to an ordinary user.
   Fix: exclude region from client INSERT privileges or require it to be NULL on initial profile creation; assign authorization scope through a trusted administrative operation.

6. **Medium — The landing-page animation leaks rendering work after unmount.**
   [PixelBlast.tsx:653](/home/highq-student/Documents/ExoG/src/components/backgrounds/PixelBlast.tsx:653) skips cleanup when `mustReinit` is true, including the initial mount. Separately, the ref stores only the first animation-frame ID while subsequent frames update a local variable. Cancelling the stored ID cannot stop the active loop.

   A local lifecycle harness using the actual transpiled component and mocked browser/renderer APIs showed one scheduled frame before unmount and one afterwards, with render count increasing from 1 to 2 and zero renderer disposals or resize-observer disconnects. The landing page remounts this component on theme/accent changes, so leaked loops and contexts can accumulate. This was a lifecycle reproduction, not a browser GPU benchmark.

   Fix: stop each loop on cleanup, cancel its current frame ID, disconnect observers, remove listeners and dispose GPU resources unconditionally on unmount. Keep resource creation and uniform updates in separate effects.

7. **Medium — Public pages eagerly download the supposedly deferred auth and PDF bundles.**

   [SiteHeader.tsx:8](/home/highq-student/Documents/ExoG/src/components/SiteHeader.tsx:8) imports the full auth module, which pulls Clerk and Supabase into the public landing-page dependency graph. [vite.config.ts:38](/home/highq-student/Documents/ExoG/vite.config.ts:38) places jsPDF/JSZip in a manual chunk that also receives a shared preload helper needed by the entry module.

   Verified in the generated build: `dist/index.html` preloads `charts`, and the landing chunk imports Clerk and Supabase. Those three bundles total approximately **232 kB gzip**: charts 156.34 kB, Supabase 54.34 kB, Clerk 21.27 kB. This excludes other landing-page code and the deferred PixelBlast bundle, which is another 139.53 kB gzip.

   Fix: separate the lightweight auth context/public header from the provider implementation, and adjust chunking so shared runtime helpers do not pull optional exporters into the entry graph. Verify the generated module graph after changing the configuration.

8. **Medium — Opening a care record downloads and renders its entire history.**
   [SentinelView.tsx:216](/home/highq-student/Documents/ExoG/src/components/dashboard/SentinelView.tsx:216) calls [fetchAllCareLogs:102](/home/highq-student/Documents/ExoG/src/lib/care-logs.ts:102) on first selection. That function fetches 200-row pages sequentially until exhausted; [SentinelView.tsx:710](/home/highq-student/Documents/ExoG/src/components/dashboard/SentinelView.tsx:710) then renders every entry.

   At 10,000 entries, this requires 51 requests before the history is installed in state, followed by 10,000 rendered entries. Multiple visited histories remain cached in component state. Latency and memory therefore grow with the complete historical record. This is derived from control flow, not a measured production dataset.

   Fix: paginate the visible log with a stable cursor and virtualize long lists. Load the complete record only for an explicit export, with bounded concurrency or a server-side export and cancellation support.

9. **Medium — A confirmation-email outage deletes a successfully persisted application.**

    [submit-sentinel-application/index.ts:504](/home/highq-student/Documents/ExoG/external-supabase/functions/submit-sentinel-application/index.ts:504) sends email after saving the application, uploaded files and document metadata. A provider error falls into the same catch block as a failed submission, which calls cleanup and deletes those records/files.

    Fix: commit the application independently of notification delivery; enqueue email for retry. Persist an explicit notification state instead of requiring users to upload their documents again during an email-provider outage.

10. **Medium — Fresh database setup fails at migration 00003.**

    [00003_cites_species.sql:65](/home/highq-student/Documents/ExoG/external-supabase/migrations/00003_cites_species.sql:65) grants privileges on `public.cites_species_id_seq`, but the table defines `id integer primary key`, not SERIAL or IDENTITY. No such sequence is created anywhere in the migration sequence. Fresh replay failed with `relation "public.cites_species_id_seq" does not exist`.

    Fix: remove the unused sequence grant or define an actual identity sequence if that is intended. Also explicitly provide or guard migration 00037's dependency on `public.rls_auto_enable()`, which is not defined in this repository. Add a fresh-database migration check before relying on the existing smoke-test SQL.

11. **Dependency advisories — Update the lockfile with reachability-aware review.**

    `npm audit` reported **13 affected packages: 1 critical, 3 high and 9 moderate**. These package counts include transitive propagation; they are not 13 independently demonstrated application exploits.

    - Runtime dependency DOMPurify 3.4.16, pulled in by jsPDF, has critical/moderate advisories. The [critical advisory](https://github.com/advisories/GHSA-cg2g-xh64-v4q7) requires specific template and DOM-output behavior. No direct DOMPurify or jsPDF `.html()` calls were found in application code, so exploitability through the current export paths was not established.
    - Runtime dependency Zod 3.25.76 has an oversized-collection memory exhaustion advisory. It is used in browser-side validation here; the edge functions do not import it. [Advisory and patched version](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
    - Development dependencies include affected Vite 7.3.6, Vitest/mocker 4.1.11, Undici 7.30.0 and nested minimatch. Vite binds all interfaces via `host: true`, increasing exposure if the developer machine is reachable. The [Vite file-serving advisory](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) lists 7.3.7 as a patched version. These development-server issues do not imply the static nginx deployment has the same exposure.

    Fix: update affected packages within compatible release lines and retest; plan Zod's major-version migration separately. Avoid blindly applying `npm audit fix --force` because its proposed changes include major-version changes and a tooling downgrade.

Temporary reproduction artifacts are [the database harness](/tmp/exog-sql-review/review.mjs), [database results](/tmp/exog-sql-review/results.txt), [the animation harness](/tmp/exog-sql-review/animation-review.cjs), and [raw dependency audit](/tmp/exog-audit.json). They contain synthetic test data only and live outside the repository. Policy evaluation was cross-checked against [PostgreSQL's row-security documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html): permissive policies combine with OR, and row-level access does not replace table privileges.

---

**Approved shelters and government accounts can browse all approved sentinels nationwide**, including contact, capacity, and suitability details for triage. Private KYC documents, birth dates, and reviewer notes remain protected.

Also fixed permission bypasses, account deletion, email failure handling, animation cleanup, unnecessary downloads, care-history pagination, migration errors, and vulnerable dependencies. Full-history exports remain available.

Validation passed:

- All 20 app tests, plus database, edge-function, and animation regressions.
- Type checking and production build.
- Dependency audit: **zero known vulnerabilities**.
- Lint: zero errors; five existing warnings.

**These changes are local, not deployed.** The coordinated migration, function, scheduler, and frontend rollout is documented in REMEDIATION_DEPLOY.md (REMEDIATION_DEPLOY.md).
