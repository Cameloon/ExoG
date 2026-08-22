# BioSteward — External Supabase + Clerk Setup

You chose to run this app against your own Supabase project (instead of
Lovable Cloud) with Clerk for authentication. This file walks you through
every step. Allow ~30 minutes the first time.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> → **New project**.
2. Pick a region close to your users. Save the database password somewhere safe.
3. Once provisioned, open **Project Settings → API** and copy:
   - **Project URL** (e.g. `https://abcd1234.supabase.co`)
   - **anon / public key** (the long `eyJ...` string)
   - **JWT Secret** (under "JWT Settings" — you'll need this for Clerk)

## 2. Create a Clerk application

1. Go to <https://clerk.com> → **Add application**.
2. Enable **Email** and **Google** sign-in (anything else is fine too).
3. Open **API Keys** and copy the **Publishable key** (`pk_test_...` or `pk_live_...`).
4. Open **JWT Templates** → **+ New template** → choose **Supabase**.
   - Name it exactly **`supabase`** (lowercase).
   - Paste the **JWT Secret** from step 1 into the **Signing key** field.
   - Save.

## 3. Run the SQL migrations in Supabase

1. In Supabase, open **SQL Editor → New query**.
2. Paste and run each file from `external-supabase/migrations/` **in filename
   order** (`00001_init.sql` … up to the highest number present). Each file is
   idempotent, so re-running one is safe.
3. You should see `Success` for every file.
4. This creates: `profiles`, `user_roles`, `sentinel_applications`,
   `application_documents`, `application_audit_log`, `ward_listings`,
   `ward_interest`, `shelters`, `sentinel_shelter_requests`,
   `pending_shelter_requests`, `cites_species`, `care_logs`, the
   `kyc-documents` / `ward-images` storage buckets, and all RLS policies.

## 4. Deploy the edge functions (web dashboard, no CLI needed)

All edge function management happens in the **Supabase Dashboard → Edge Functions**
tab. For each function, click **"Create a new function"** (or open an existing
one), paste the source from `external-supabase/functions/<name>/index.ts`, and
deploy.

Four functions to deploy/create:

| Function | Action | File |
|----------|--------|------|
| `kyc-upload` | Create | `external-supabase/functions/kyc-upload/index.ts` |
| `delete-account` | Create | `external-supabase/functions/delete-account/index.ts` |
| `send-application-confirmation` | Create (or update if it exists) | `external-supabase/functions/send-application-confirmation/index.ts` |
| `submit-sentinel-application` | Create (or update if it exists) | `external-supabase/functions/submit-sentinel-application/index.ts` |
| `set-user-role` | Create | `external-supabase/functions/set-user-role/index.ts` |

### Secrets

Still in **Edge Functions**, open **"Manage Secrets"** (or Project Settings →
API → Edge Functions → Secrets) and set these key-value pairs:

| Secret | Value |
|--------|-------|
| `APP_ORIGIN` | Your app URL, e.g. `http://localhost:5173` for local dev or `https://app.deinedomain.de` for production |
| `CLERK_SECRET_KEY` | From **Clerk Dashboard → API Keys** — the server-side key (starts with `sk_`) |
| `CLERK_DOMAIN` | e.g. `ideal-tetra-26.clerk.accounts.dev` — your Clerk instance domain |
| `BREVO_API_KEY` | From **brevo.com → SMTP & API → API Keys** — only needed if you want real confirmation emails. Brevo: EU-based (FR), 300 mails/day free tier, DPA available |
| `EMAIL_FROM` | Verified sender address for Brevo, e.g. `BioSteward <noreply@deinedomain.de>` |

All functions share the same secrets — set once, used by all.

## 5. Fill in `src/config/external.ts`

Open `src/config/external.ts` and replace the three placeholders with the
values you collected:

```ts
export const EXTERNAL_CONFIG = {
  SUPABASE_URL: "https://abcd1234.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGc...",
  CLERK_PUBLISHABLE_KEY: "pk_test_...",
  CLERK_SUPABASE_JWT_TEMPLATE: "supabase",
};
```

Save. The app will reload and the "External backend not configured"
screen should disappear.

## 6. Promote yourself to admin

1. Sign up in the app at `/auth`.
2. Open **Clerk dashboard → Users**, find yourself, copy your **User ID**
   (looks like `user_2abc...`).
3. In Supabase **SQL Editor**, run:

```sql
insert into public.user_roles (user_id, role)
values ('user_PASTE_YOUR_ID_HERE', 'admin');
```

4. Sign out and back in. The **Admin** nav link now appears.

## 7. (Optional) Auto-create profile rows on signup

Right now signing up creates a Clerk user but does **not** create a row
in `public.profiles`. The app works fine without it (profiles are mostly
informational), but if you want them auto-created:

1. In Clerk, go to **Webhooks → + Add endpoint**.
2. Point it at a new edge function you write that listens for the
   `user.created` event and inserts into `profiles`. Use the Supabase
   service role key (set as a function secret via
   `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...`).
3. The skeleton lives in
   `external-supabase/functions/send-application-confirmation/index.ts`
   — copy and adapt.

---

## Architecture in two paragraphs

**Auth.** Clerk handles all sign-up, sign-in, password reset, social
login, and user management. On every Supabase request, the React app
fetches a fresh Clerk JWT (issued via the `supabase` template, which is
signed with your Supabase JWT secret), and sends it as the
`Authorization: Bearer ...` header. Supabase verifies the signature
locally and exposes the JWT claims to RLS via `auth.jwt()`.

**Authorisation.** The Clerk user id (a string like `user_2abc...`) is
stored in `user_id` columns (`text`, not `uuid`). RLS policies compare
those columns to `auth.jwt() ->> 'sub'`. Admin role is stored in
`public.user_roles` and checked by the `has_role(user_id, role)`
security-definer function — same pattern as the original Lovable Cloud
setup, just with text ids.

---

## Common issues

- **"new row violates row-level security policy"** — your Clerk JWT
  template isn't signed with the Supabase JWT secret, OR the template
  isn't named exactly `supabase`. Check Clerk → JWT Templates.
- **Edge function 401** — make sure you deployed with `--no-verify-jwt`.
  The function is intentionally public; abuse protection should come
  from rate limits or a captcha if you go to production.
- **Storage upload fails** — confirm the `kyc-documents` bucket exists
  in Supabase **Storage** (the SQL migration creates it).
- **Admin link doesn't appear** — sign out and in once after inserting
  into `user_roles`. The role is read from `user_roles` via the JWT, not
  cached client-side, but the React state needs a refresh.
