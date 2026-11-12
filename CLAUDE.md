# Kanban

Mini Trello-style Kanban board.

## Stack
- Backend: ASP.NET Core Web API (.NET 10, controllers) in `backend/Api`. Dapper + Microsoft.Data.SqlClient. No EF Core.
- Data access: `IDbConnectionFactory` in `Data/`; repositories open one connection per method.
- Database: SQL Server 2022 in Docker (container `kanban-db`, database `Kanban`, port 1433).
- Migrations: DbUp. Numbered scripts in `backend/Api/Migrations` (embedded resources), run at API startup.
  Never edit an applied script; add a new numbered one.
- Frontend: Vite + React + TypeScript + ESLint in `frontend/`. Vite proxies `/api` to http://localhost:5047.
  Styling: Tailwind CSS v4 + shadcn/ui (slate theme). Add components with `npx shadcn@latest add <name>` (lands in `src/components/ui/`). `@/` aliases `src/`.
- Connection string lives in dotnet user-secrets (`ConnectionStrings:Default`), not in the repo.

## Run
- `docker start kanban-db kanban-mailpit` (Mailpit: fake SMTP on 1025, inbox UI at http://localhost:8025)
- `cd backend/Api && dotnet run` (http://localhost:5047)
- `cd frontend && npm run dev` (http://localhost:5173)
- E2E tests: `cd e2e && npm test` (first time: `npm install && npx playwright install chromium`). Starts its own isolated stack (SQL Server 14330, Mailpit 1026/8026, API 5147, Vite 5273) and never touches the dev containers. `global-teardown.ts` removes the e2e containers after each run; `KEEP_E2E_STACK=1` keeps them (faster re-runs), `npm run down` removes them by hand. ~30s (+15s SQL Server startup when the containers are fresh).
- Frontend tests: `cd frontend && npm test` (watch: `npm run test:watch`, coverage: `npm run test:coverage`). No backend or Docker needed.
- Backend tests: `cd backend/Api.Tests && dotnet run` (or `dotnet test` from `backend/`). Needs Docker running; starts its own throwaway SQL Server container (does not touch `kanban-db`). ~25s.

## Planned
Done: JWT auth, boards/columns/cards CRUD, drag and drop (dnd-kit), real-time board updates (SignalR hub `/hubs/board`, "BoardChanged" ping then refetch).
Also done: board member management (roles owner/editor/viewer; only owners manage columns, board settings and members; editors do cards; viewers read-only), archived-board restore (owners, within 30 days).
Also done: daily purge job (stored proc `PurgeArchivedBoards` called by `ArchivePurgeService`; boards archived >30 days move to `Deleted*` tables) and restore from the long-term archive (`RestorePurgedBoard`: purged -> archived -> owner restores as usual).
Also done: full test suite and CI. Backend integration + unit tests (153), frontend tests (133), Playwright e2e (51), and the GitHub Actions workflow `.github/workflows/ci.yml` (see Testing and CI below).
Next: nothing scheduled.

## Later (decided to do later)
- Live updates on the board list page (new/renamed/deleted boards appear without a refresh).
- Presence indicators (avatars of who is viewing the board right now).
- Live cursors (see collaborators' pointers and drags in real time).
- Granular SignalR events (patch state in place) instead of "BoardChanged, refetch" if refetching ever feels slow.

## Deferred auth upgrades (decided to do later)
- Rate limit forgot-password per email (currently per IP only, built-in ASP.NET limiter, in-memory).
- Move rate-limit counters to Redis (or similar) so they survive restarts and work across instances.
- Rate limit login (not limited yet).
- Invalidate old login cookies after a password reset (JWTs stay valid up to 60 min). Fix: per-user token version checked on each request.

## Purge / long-term archive
- Migration 0004: `DeletedBoards/DeletedColumns/DeletedCards/DeletedBoardMembers` mirror the live tables (+ `PurgedAt`, original ids, no identity/FKs), kept forever.
- `dbo.PurgeArchivedBoards @RetentionDays`: batched, moves board + members + columns + cards (incl. already soft-deleted ones). `ArchivePurgeService` runs it at startup and every 24h with `ArchivePolicy.RetentionDays` (`Models/BoardRole.cs`).
- `dbo.RestorePurgedBoard @BoardId, @UserId`: only someone who was an owner at purge time; re-inserts with IDENTITY_INSERT as an ARCHIVED board (fresh 30-day window) and removes the Deleted* rows. API: `GET /api/boards/purged`, `POST /api/boards/{id}/restore-purged`.
- **Any migration that adds/changes a column on Boards, Columns, Cards or BoardMembers must also change the matching `Deleted*` table and recreate both procs (`CREATE OR ALTER`, explicit column lists).**

## CI (GitHub Actions)
- `.github/workflows/ci.yml` runs on pushes to `main` and on every PR, as three parallel jobs: `backend` (`dotnet test` with Cobertura coverage; Testcontainers uses the runner's Docker), `frontend` (`npm ci`, lint, build, `test:coverage`), `e2e` (Playwright with `CI=true`: 2 workers, GitHub reporter; HTML report + traces uploaded as an artifact).
- Coverage percentages appear in each job's summary; full reports are artifacts (14 days). No coverage threshold is enforced yet.
- Newer pushes to the same PR cancel the older run (`concurrency`).
- Branch protection (making the three jobs required checks) is a GitHub repo setting, not code.
- Locally validated only (YAML parses, every command and summary snippet runs, `CI=true npx playwright test` passes); the first real run happens on GitHub.

## Testing
- `backend/Kanban.slnx` holds `Api` and `Api.Tests`. `Program.cs` ends with `public partial class Program;` so `WebApplicationFactory<Program>` works.
- `Api.Tests/Infrastructure`: `ApiFixture` (one MSSQL container per run, Respawn reset before each test, DbUp journal `SchemaVersions` kept), `ApiFactory` (real app, only `IEmailSender` swapped for `FakeEmailSender`), `IntegrationTest` base (`NewUserAsync`, `CreateBoardAsync`, etc.).
- Config reaches the app via environment variables (`ConnectionStrings__Default`, `Jwt__Key`, `Smtp__*`) set before the host starts, because `Program.cs` reads config eagerly.
- Unit tests (`Unit/`) need no Docker or DB; they mock repositories with NSubstitute and call controllers directly via `AsUser(userId)` (`ControllerTestHelpers`). Integration tests (`Integration/`) use the real stack.
- Keep `xUnit1051` enabled: pass `TestContext.Current.CancellationToken` to every async call in tests.
- Tests share one DB, so they run serially (single xUnit collection). Tests touching the in-memory rate limiter use `CreateIsolatedFactory()` for fresh counters.
- SignalR tests use long polling over the TestServer with the login cookie in a `Cookie` header.
- New migrations/features: add integration tests alongside; changes to Boards/Columns/Cards/BoardMembers need purge/restore test coverage.

## Frontend testing
- Vitest + jsdom, config in the `test` block of `vite.config.ts`; setup in `src/test/setup.ts`. Tests sit next to the code (`Foo.test.tsx`).
- MSW intercepts `fetch` (`src/test/server.ts`); any request without a handler fails the test (`onUnhandledFrame: 'error'`). Handlers use absolute URLs via `url('/boards')` from `src/test/utils.tsx`. MSW 3 renamed `onUnhandledRequest` to `onUnhandledFrame`.
- `renderWithProviders(ui, { route, path, user, auth })` gives a MemoryRouter plus a fake auth context; `locationOf()` asserts redirects; `makeBoard(role)` builds board fixtures.
- Mock `sonner` (`toast`) and `useBoardRealtime` per test file; the SignalR hook itself is tested against a fake connection.
- Do not wrap a rejecting call in RTL `act()` (state updates are not flushed); call it directly and `waitFor` the result.

## E2E testing
- `e2e/playwright.config.ts` boots everything via `webServer`: `docker compose up --wait` (`e2e/docker-compose.yml`) then `dotnet run` on :5147 (env vars supply connection string, JWT key, SMTP, `App__FrontendUrl`), plus Vite on :5273 with `VITE_API_URL` (the proxy target in `vite.config.ts` is now overridable).
- Tests isolate themselves with unique users/boards instead of resetting the DB. Set-up goes through the API (`e2e/helpers/api.ts`, e.g. `seedBoard`, `signUpAndLogin`); the UI is used for what is being tested. Reset emails are read from the Mailpit API (`helpers/mailpit.ts`); purge time travel uses `sqlcmd` in the container (`helpers/db.ts`).
- **Forgot-password is rate limited (3 per IP per 15 min, in the API's memory).** Password-reset specs make exactly 2 such requests; the API is therefore started fresh every run (`reuseExistingServer: false`) and retries are off. Don't add more forgot-password calls without raising this.
- Drag and drop: use `drag()` from `helpers/board.ts`. It grabs near the card's top edge, aims at the target's original box within a column (dnd-kit decides the hovered item from original layout, items only shift visually) and re-measures when entering another column (the board inserts the card, which moves layout), and it waits for the move request to finish. The board shows a drop instantly, before the server saved it, so a test that reloads right after a drop must wait for the save (that race caused all the early flakiness).
- dnd-kit gives cards `role="button"` (use `section ul > li`, not `listitem`) and `aria-disabled="true"` for viewers (use `click({ force: true })`).
- Real bug found by E2E: `GuestRoute` redirected to `/` after login, ignoring the remembered `from`; fixed (and unit tested).

## Notes
- Users table exists (migration 0001).
- Shell is zsh: single-quote any string containing `!`.
- After completing a feature, update README.md (features, API table, structure, roadmap) and the Planned section here.
- Respond with brief and sharp points. Do not over explain process unless explicitly asked for. 