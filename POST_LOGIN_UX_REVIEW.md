Post-login workflow review — branch `ux/post-login-workflows`

The existing visual language is retained: typography, color tokens, accents, cards, spacing conventions, and dark/light themes. Changes focus on access, task completion, feedback, keyboard use and responsive behavior.

Role coverage

| Role | Working paths reviewed and improved |
| --- | --- |
| Applicant | Application/status overview, pending/rejected states, both sentinel and shelter application paths, return to the requested page after login |
| Sentinel | Own animals, care logs, complete-history exports, duties, enclosure maintenance, applications to shelters, editing an owned animal |
| S4 expert | Sentinel workspace plus paginated identification requests and vote submission |
| Shelter | Profile, animals, requests, nationwide sentinel discovery, named assignment picker, confirmed requests that actually assign custody |
| Government | Regional dashboard, animal administration, care for owned animals, regional care-history browsing, document generation, national sentinel discovery, location profile |
| Admin | Application and qualification review with an atomic audit record, address review, shelter approvals, role administration, animal management |
| Sentinel + approved shelter | Retains the sentinel home and access to the institution profile, management tools and nationwide directory |

Changes

- Role navigation exposes reachable tools; the logo returns to the role's overview. Desktop navigation collapses before it overflows. Links identify the active page for assistive technology, and mobile navigation remains scrollable.
- Login keeps safe local destinations, including query strings. Google sign-in now has the required Clerk callback route and visible, retryable initiation errors. Pending applicants get a real status overview instead of another registration wizard. Status refresh reloads newly granted access.
- A failed care bootstrap shows an error and retry action; demo profiles and statistics cannot masquerade as live data. The complete owned-animal list is fetched in batches instead of stopping at 100.
- Duties and enclosure editors retain drafts on failed saves. Enclosure edits close only after persistence succeeds. Switching animals warns about an unsaved care entry; document drafts reset with the selected animal.
- Government users can open the animal workspace. Authorized shelter staff can manage animals still associated with their shelter after custody assignment. A sentinel can edit an owned animal even though they cannot create staff listings.
- Government animal forms show the assigned region as read-only, matching the scope that is saved.
- Animal search and placement/quarantine filters query the database across all pages. Stale searches are cancelled. Management links from shelter cards search by case code.
- Staff assign a named, approved sentinel through a searchable national picker instead of copying account IDs. Capacity JSON is shown as readable habitat counts.
- Shelter matching explicitly confirms assignment and updates the ward and request together. Admin review explicitly selects S1–S4 and commits the application decision, qualification and audit entry together. These operations require migration 00039.
- Authority urgency colors/counts now recognize the values the forms save. Completed/withdrawn animals are excluded from the active count. Initial and changed selections load their own history; stale results do not overwrite a newer selection. Care history is paginated and load failures are visible.
- Government document tools expose the existing seizure, found-animal, adoption and CITES exports. Document form labels are associated with their inputs. No new automatic filing service is implied.
- Animal detail dialogs contain keyboard focus, close with Escape and restore focus to the opening card. Dialogs, sheets and select menus inherit the app's accent and typography through portals. Phone-width overflow in the regional dashboard is fixed.
- Theme switching tolerates an interrupted browser transition and respects reduced-motion preferences.
- S4 experts have a visible Bestimmungshilfe tab. Identification queues distinguish failure from an empty queue. Expert requests are paginated; creation and decision actions refresh the first page instead of appending an unrelated next page. Species inputs have associated labels and independent suggestion lists, and discard stale search results.
- Header and footer links now point to existing landing-page sections and information pages from inside the app.
- Saved profile display names are reflected in the app. Failed or unauthorized updates that return no row are not reported as successful animal/account changes.

Advertised features that are not implemented in this repository

The landing page currently describes capabilities beyond the available application. These are separate product/integration gaps, not completed work in this branch:

| Advertised capability | Repository evidence / present behavior |
| --- | --- |
| AI species identification “in minutes” | Photo requests and human S4 votes exist; no AI inference service or response-time guarantee is implemented. |
| GPS and temperature tracking during transport | Transport records store manually entered locations, carrier, checklist and notes. No tracker ingestion, continuous GPS route or temperature-sensor integration exists. |
| Cryptographically signed custody handovers / QR handover | Care records have a server-created hash chain. That is not a qualified identity signature. No end-to-end QR handover/signing workflow is present. |
| Automated regulatory reporting | PDF/JSON/ZIP document exports work. No agency submission endpoint, automatic filing scheduler or delivery receipt workflow exists. |
| On-site verification, insurance coverage, guaranteed placement time or courtroom admissibility | Software alone cannot verify these operational/legal promises. They need established processes, providers and evidence beyond this repository. |

Public marketing copy was not rewritten. The gaps above must be resolved or the claims revised before presenting those capabilities as live. The branch does not certify legal compliance, completed live integrations, or every third-party account setting.

Validation and limits

Updated validation after Dashboard-fixes integration: 34 unit tests and 27 browser tests passed; database regression checks, type checking, production build and public-bundle guard passed. ESLint has zero errors and five existing Fast Refresh warnings. The prior dependency audit found zero known vulnerabilities; dependency versions are unchanged by the Dashboard-fixes integration. The public entry plus landing remains 148.06 kB gzip, with authentication and PDF code deferred.

- `npm test` checks application logic, including role navigation, local redirect validation, directory access, care pagination and existing domain tests.
- `npm run test:db` replays all migrations in PGlite/PostgreSQL with synthetic Supabase auth/storage schemas. It exercises access restrictions, matching, explicit qualification approval, and injected failure rollback for review/audit and account deletion.
- `npm run test:ux` uses Chrome with the real React pages and isolated synthetic auth/API responses. It covers each role's dashboard at 375 px dark mode and 1536 px light mode, menus, dialog keyboard behavior, pending applications, nationwide discovery, document ZIP download, admin qualification submission, failed-save draft retention, database search, owner edits, mixed roles, expert voting, and Google redirect/callback wiring and initiation failure. It never contacts live Supabase, Clerk, email or map services; the Google tests verify application wiring, not a live provider round trip.
- Browser fixtures are enabled only by `vite.ux.config.ts`; the production build uses `vite.config.ts`. Set `CHROME_PATH` if Chrome is not at `/usr/bin/google-chrome`. Screenshots/traces are generated under ignored `test-results/ux/`.
- Run `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:bundle` and `npm audit` for the remaining checks. The bundle guard prevents optional auth/export code from entering the public landing dependency graph.
- These checks do not replace authenticated acceptance testing against the deployed database and real Clerk configuration. Live email, uploads, geocoding and regulatory integrations have not been exercised.

Deployment

1. Start from the security-remediation release through migration 00038; see `REMEDIATION_DEPLOY.md` if it is not deployed yet.
2. On an existing database at 00038, apply `external-supabase/migrations/00039_workflow_commands.sql`, then `00040_ward_intake_type.sql`. At 00039, only add 00040. Do not replay destructive initialization migrations.
3. Publish the matching frontend build. Review/matching require the 00039 RPCs and intake/documents require the 00040 column; migrate before publishing the client.
4. With disposable live test accounts, verify Google sign-in through `/sso-callback`, pending → approval → role refresh, cross-region discovery, shelter assignment → animal visible in the recipient's care workspace, S4 voting, own/regional edits, uploads and exports. No live deployment was performed here.

Design references used

- [W3C WAI: Forms](https://www.w3.org/WAI/tutorials/forms/) — labels, instructions and understandable completion/error feedback.
- [W3C WAI: Reflow](https://www.w3.org/WAI/WCAG21/Understanding/reflow) — usable layouts without page-wide horizontal scrolling.
- [W3C WAI: User notifications](https://www.w3.org/WAI/tutorials/forms/notifications/) — visible, actionable error and success messages.
- [Nielsen Norman Group: Empty states](https://www.nngroup.com/articles/empty-state-interface-design/) — distinguish no data from failure and provide the next useful action.
- [Clerk: OAuth callback component](https://clerk.com/docs/reference/components/control/authenticate-with-redirect-callback) — complete the existing custom Google sign-in flow on its configured redirect route.
- [MDN: ViewTransition.ready](https://developer.mozilla.org/en-US/docs/Web/API/ViewTransition/ready) — handle a skipped animation without an unhandled rejection.

For the subsequent Dashboard-fixes integration, connected intake/CITES/document workflows and the updated validation, see [DASHBOARD_WORKFLOW_INTEGRATION.md](DASHBOARD_WORKFLOW_INTEGRATION.md).
