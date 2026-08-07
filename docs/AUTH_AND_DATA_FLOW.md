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

## Mock → Supabase migration

- Pages previously used `services/mock/ui-adapters.ts`.
- Active exports now come from `services/app/*`.
- `src/data/mock.ts` and `services/mock/ui-adapters.ts` remain on disk unused by pages (reference only).

## Empty-user experience

Dashboard, jobs, companies, and applications show intentional empty states when the user has no rows yet.

## Known limitations

- Email confirmation may be autoconfirm-enabled for MVP; harden for production.
- Direct `supabase db push` still blocked by IPv6 on some networks.
- Assistant page still uses canned replies with a Phase-4 disclaimer.
- No AI generation for job analysis or artifacts yet.
- Cross-user isolation relies on RLS; automated multi-user e2e is manual.
