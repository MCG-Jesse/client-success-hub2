# Joan — Session Notes: 2026-07-08

Dated snapshot of one working session. The **living** architecture/state doc is
[`CLAUDE_HANDOFF.md`](CLAUDE_HANDOFF.md) (kept current — read it first next time);
this file is just this session's decisions + next steps.

## What shipped today (all live on `main` / prod unless noted)
- **UI polish:** removed the header tagline; iPhone-friendly fixes (sidebar starts
  collapsed on phones, tighter padding, header stats hidden on mobile, modals cap at
  90vh and scroll).
- **Team Calendar:** availability (time off / travel / sick / holiday) + client events
  (meeting / training / other) on a month grid. New `calendar_events` table;
  `CalendarEventsView` + `CalendarEventModal`; "out this week" strip, person/type filters.
- **Sunday-first** weeks everywhere (Calendar view + the Today mini-calendar).
- **Roles tightened:** Team roster and Clients are now owner/admin-only to edit; members
  keep full read/visibility. Enforced in **RLS** (`admins manage <table>`) **and** UI
  (`canManage`). Verified with role-simulated DB tests.
- **Login UX:** lands on **Today**, defaulted to the logged-in user's **own tasks**
  (per-user, remembered).
- **Feedback loop:** floating Feedback button → `feedback` table; users see only their
  own submissions + status; product feedback routes to the operator (not teammates).
- **Morning digest routine:** `joan-feedback-digest` runs ~7:30am daily and
  push-notifies Jesse only when there's new feedback (notify-only). Verified the
  background run can reach Supabase.

## Key decisions
- **Role model:** members SEE everything (collaborative hub) but cannot edit the Team
  roster or Clients — a deliberate choice, NOT "members only see their own tasks."
  Tasks / projects / calendar remain member-writable.
- **Feedback review:** operator/Claude reviews via Supabase MCP (query `feedback` where
  `status='new'`, triage, set `status` new→reviewing→done/declined). No in-app admin
  dashboard — matches the no-super-admin design.
- **Digest is push, not email:** email *sending* isn't wired up (Gmail connector only
  drafts). A real email digest needs the deferred Resend/SMTP setup.
- **Leaked-password protection left OFF:** it's a Supabase **Pro-only** feature; not
  worth upgrading for that alone at pilot scale.
- **Deploy discipline:** DB migrations apply live via MCP (instant); frontend needs
  `git push origin main` (Render ~5 min); every prod push explicitly approved.

## Next steps (all open / optional — app is live and working)
- **Custom SMTP (Resend)** — highest-value unlock: enables invite + confirmation emails
  AND upgrading the feedback digest from push to real email. Runbook:
  [`SMTP_SETUP.md`](SMTP_SETUP.md).
- **Revisit Supabase Pro** when pilot → real traffic: avoids free-tier project
  auto-pause, adds backups, and unlocks leaked-password protection.
- **Automatic invite emails** (Edge Function on invite insert) — unblocked once Resend is in.
- **Merge "Workspace Access" + "Team Members"** into one People list.
- **Jesse housekeeping:** delete the duplicate "Jesse" team seat in the Team tab.
- **Ongoing:** triage pilot feedback as it arrives (the morning digest will flag it).

## Pointers
- Canonical living doc: `CLAUDE_HANDOFF.md` (architecture, schema, gotchas, test-user +
  deploy patterns).
- Resend/SMTP runbook: `SMTP_SETUP.md`.
- Two pilot users are actively testing; feedback comes in via the in-app button.
