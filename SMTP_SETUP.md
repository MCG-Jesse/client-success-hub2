# Joan — Custom SMTP Setup (Resend)

**Goal:** Replace Supabase's rate-limited built-in email sender with Resend so auth
confirmation + invite emails actually send reliably to real users.

**Why:** Supabase's built-in SMTP throttles hard ("email rate limit exceeded") and is
explicitly *not for production*. Custom SMTP removes that ceiling.

**Who does what:** These steps live in the Resend and Supabase **dashboards** — they are
not code or DB migrations, so you (Jesse) click through them. Claude can't reach these
dashboards from the CLI. Once done, ping Claude to verify sending + adjust rate limits.

- **Supabase project:** `joan` / ref `xlarzxakwdzblitobbrt`
- **App Site URL:** https://client-success-hub2.onrender.com
- **Chosen sender domain:** `munizconsultinggroup.com` (swap at Step 2 if you prefer another)
- **Chosen sender address:** `noreply@munizconsultinggroup.com` (name: `Joan`)

---

## Step 1 — Create a Resend account
1. Go to https://resend.com → **Sign up** (free tier = 3,000 emails/mo, 100/day — plenty to start).
2. Verify your email, log in.

## Step 2 — Add + verify your sending domain
1. Resend dashboard → **Domains** → **Add Domain**.
2. Enter `munizconsultinggroup.com` (or your chosen domain) → **Add**.
3. Resend shows a set of **DNS records** to add (typically):
   - a **DKIM** `TXT` record (host like `resend._domainkey`),
   - an **SPF** `TXT` + **MX** pair on a `send.` subdomain,
   - (optional but recommended) a **DMARC** `TXT` at `_dmarc`.
4. Add each record **exactly as shown** in your domain's DNS host (wherever
   `munizconsultinggroup.com` DNS is managed — e.g. Cloudflare, GoDaddy, Namecheap).
   - Copy values verbatim. Don't append the domain if the host field already implies it.
5. Back in Resend, click **Verify**. DNS can take minutes–hours to propagate; re-check until
   all records show **Verified** (green). **Do not proceed to Step 4 until verified** —
   unverified domains can't send.

## Step 3 — Create a Resend API key
1. Resend dashboard → **API Keys** → **Create API Key**.
2. Name it `joan-supabase-smtp`, permission **Sending access**, domain = your verified domain.
3. **Copy the key now** (`re_...`) — it's shown once. This is your SMTP password.

## Step 4 — Enter SMTP settings in Supabase
1. Open Supabase → project `joan` → **Authentication** → **Emails** (a.k.a. SMTP Settings)
   → https://supabase.com/dashboard/project/xlarzxakwdzblitobbrt/auth/templates
   (look for the **SMTP Settings** / **Custom SMTP** section) → toggle **Enable Custom SMTP**.
2. Fill in **exactly**:
   | Field                | Value                              |
   |----------------------|------------------------------------|
   | Sender email         | `noreply@munizconsultinggroup.com` |
   | Sender name          | `Joan`                             |
   | Host                 | `smtp.resend.com`                  |
   | Port                 | `465`                              |
   | Username             | `resend`                           |
   | Password             | *(your `re_...` API key)*          |
   > Sender email's domain **must match** the domain you verified in Resend, or sends fail.
   > If port 465 is blocked, try `587` or `2587`.
3. **Save**.

## Step 5 — Raise the Auth rate limits
The built-in limits were set low for the throttled sender. With Resend you can lift them.
1. Supabase → **Authentication** → **Rate Limits**
   → https://supabase.com/dashboard/project/xlarzxakwdzblitobbrt/auth/rate-limits
2. Raise **"Rate limit for sending emails"** from the low default (≈2–4/hr) to something
   like **30–100 per hour** (stay under Resend's 100/day free-tier cap).
3. Save.

## Step 6 — Test end to end
1. In a private/incognito window, go to the live app and **sign up a fresh test email**
   you control (or trigger a password reset / invite email).
2. Confirm the email arrives **from `noreply@munizconsultinggroup.com`** (check spam once;
   if SPF/DKIM verified it should inbox).
3. Check delivery in **Resend → Emails** log (shows sent/delivered/bounced).
4. Clean up the test user afterward (see handoff §3 — `delete from auth.users where email like ...`).

---

## After it works — tell Claude to:
- Re-check `get_advisors(security)` (no new warnings expected; SMTP isn't a DB change).
- Update `CLAUDE_HANDOFF.md`: move "Custom SMTP" out of "Next Steps" / "Half-implemented"
  into "Working (verified in prod)".
- Consider next item: **automatic invite emails** (Edge Function on invite insert) — now
  unblocked because a real sender exists.

## Gotchas
- **Verify the domain BEFORE entering the sender address** — sender domain mismatch = silent failure.
- **API key is shown once** — if lost, create a new one and update Supabase.
- **Free tier = 100 emails/day** — fine for launch; upgrade if signups spike.
- Custom SMTP is **dashboard-stored config**, not in the repo/`.env` — it won't show in code review.
