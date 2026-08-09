# Auth & Data Flow — Phase 3

## Authentication lifecycle

1. App boots inside `ThemeProvider` → `BrowserRouter` → `AuthProvider`.
2. `AuthProvider` calls `getSession()` and subscribes to `onAuthStateChange`.
3. When a user session exists, `ensureProfile()` loads or creates a `profiles` row (insert-only if missing; never overwrites).
4. `ProtectedRoute` waits for `isLoading`, then redirects unauthenticated users to `/login`.
5. `PublicOnlyRoute` sends authenticated users away from `/login` and `/signup` to `/dashboard`.
6. Sign-out clears the session and navigates to login.

Auth operations live in `src/services/auth.ts`. Pages use `useAuth()` only.

## Protected route architecture

```
/login, /signup          → PublicOnlyRoute (no AppLayout)
/* app routes */         → ProtectedRoute → AppLayout → pages
```

## Service / repository data flow

```
Page / Dialog
  → @/services (app facade)
    → requireUserId() + requireSupabaseClient()
    → supabase.from(...) under RLS
    → optional logActivity()
```

Pages never import `@supabase/supabase-js` client helpers for table access.

Ownership: `user_id` is always taken from `auth.getUser()` in the service layer — never from form payloads.

## CRUD structure

| Domain | Create | Read | Update | Delete / status |
|--------|--------|------|--------|-----------------|
| Profile | auto on signup | Settings | Settings | — |
| Companies | dialog | list + detail | detail | delete if no jobs |
| Contacts | company detail | company detail | — | delete |
| Jobs | JobFormDialog | list + detail | edit dialog | shortlist/skip/archive/delete |
| Applications | from job detail | kanban + list + detail | stage/notes | — |
| Job analysis | view only (manual helper exists) | job detail | — | — |
| Artifacts | service ready | application detail list | — | — |
| Activities | auto on key actions | dashboard | — | — |
| Google integration | OAuth connect | Settings | disconnect | — |
| Hiring emails | gmail-sync | Hiring Inbox | link/stage/calendar (approved) | — |

## Mock → Supabase migration

- Pages previously used `services/mock/ui-adapters.ts`.
- Active exports now come from `services/app/*`.
- `src/data/mock.ts` and `services/mock/ui-adapters.ts` remain on disk unused by pages (reference only).

## Empty-user experience

Dashboard, jobs, companies, and applications show intentional empty states when the user has no rows yet.

## Google integration (Phase 4D)

- JobPilot Auth remains Supabase email/password (or existing providers) — Google is a **connected integration**.
- OAuth tokens are encrypted server-side; the browser only sees connection metadata.
- Gmail sync and Calendar create run through Edge Functions with JWT ownership checks.
- Application stage and Calendar events change only after explicit user confirmation in Hiring Inbox.

## Known limitations

- Email confirmation: for **local closed beta**, `mailer_autoconfirm` is **enabled** so signup works without SMTP. Set `mailer_autoconfirm=false` again before limited/open public launch (see Phase 5A.3). Signup UI handles the confirmation-required path when autoconfirm is off.
- Password recovery: `requestPasswordReset()` redirects to `/login`; Auth `uri_allow_list` includes localhost Vite origins. Add production origin at deploy time. No dedicated forgot-password page yet.
- Direct `supabase db push` still blocked by IPv6 on some networks.
- AI analysis, artifacts, assistant, ingest, and Gmail classification run via Edge Functions.
- Cross-user isolation relies on RLS; automated multi-user e2e is mostly API smoke.
- Stop generation aborts the client stream; incomplete assistant rows are not persisted.
- Live Google Connect/Sync requires Google Cloud OAuth credentials configured as Edge secrets.
- Edge CORS uses an explicit origin allowlist (`JOBPILOT_APP_URL` + localhost); set production URL before public launch.
