# Kanban

A mini Trello-style Kanban board built with ASP.NET Core, SQL Server and React.

**Status:** in development. Accounts, boards, columns, cards, drag and drop, real-time updates, board members with roles and archived-board restore all work locally; the daily purge job and long-term archive are done, and the test suite is being built, backend integration tests first (see [Roadmap](#roadmap)).

## Features

- **Accounts:** register, log in and out, and reset a forgotten password by email. The session is a JWT in an httpOnly cookie, so JavaScript never touches the token.
- **Boards:** create, rename and delete boards. The creator becomes the board's owner.
- **Members and roles:** owners add people to a board (search by name or email), change their role and remove them. A board always keeps at least one owner. The Members dialog has a legend of what each role can do:

  | Role | Can do |
  |---|---|
  | Owner | Everything: manage columns, rename or delete the board, manage members, plus all card actions |
  | Editor | Create, edit, move and delete cards; cannot change columns or members |
  | Viewer | Read-only |

- **Archived boards:** a deleted board is archived for 30 days. Owners can restore it from the "Archived boards" section of the board list.
- **Long-term archive:** after 30 days a daily job moves the board (with its members, columns and cards) to separate `Deleted*` tables, kept forever. Anyone who was an owner at that point can retrieve it from the "Long-term archive" section; it returns to "Archived boards" with a fresh 30 days, and an owner restores it from there.
- **Columns and cards:** add, rename, edit and delete. Cards have a title, description and due date.
- **Drag and drop:** reorder cards and columns, and move cards between columns (mouse, touch and keyboard).
- **Real-time updates:** changes show up instantly in every tab viewing the same board.
- **Soft delete:** deleting a board, column or card hides it rather than removing the row. Boards archived for more than 30 days are moved out of the live tables by the daily purge job (see Long-term archive).

## Tech stack

| Layer | Technology |
|---|---|
| Backend | ASP.NET Core Web API (.NET 10, controllers) |
| Data access | Dapper + Microsoft.Data.SqlClient (no EF Core) |
| Database | SQL Server 2022 (Docker) |
| Migrations | DbUp (versioned SQL scripts) |
| Auth | JWT in an httpOnly cookie, ASP.NET Core `PasswordHasher`, built-in rate limiter |
| Email | MailKit; [Mailpit](https://mailpit.axllent.org/) as a local fake SMTP server |
| Real-time | SignalR |
| Frontend | React + TypeScript, built with Vite |
| UI | Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com/) (slate theme, follows the OS light/dark setting) |
| Routing / drag and drop | React Router, dnd-kit |

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- Node.js (current LTS; Vite requires 20.19+ or 22.12+)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on Apple Silicon, enable Rosetta emulation for x86_64/amd64 images)

## Getting started

### 1. Clone

```bash
git clone https://github.com/rjvshankar/kanban.git
cd kanban
```

### 2. Start SQL Server and Mailpit

```bash
docker run -d --name kanban-db --platform linux/amd64 \
  -e ACCEPT_EULA=Y -e 'MSSQL_SA_PASSWORD=YourStrong!Passw0rd' \
  -p 1433:1433 -v kanban-data:/var/opt/mssql \
  mcr.microsoft.com/mssql/server:2022-latest

docker run -d --name kanban-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
```

On later runs, start the existing containers with `docker start kanban-db kanban-mailpit`.

Mailpit catches the password-reset emails: SMTP on port 1025, inbox at http://localhost:8025.

### 3. Configure secrets

Secrets are stored with [.NET user secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets), not in the repository. From `backend/Api`:

```bash
dotnet user-secrets set 'ConnectionStrings:Default' 'Server=localhost,1433;Database=Kanban;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True'
dotnet user-secrets set 'Jwt:Key' "$(openssl rand -base64 48)"
```

Use single quotes for anything containing `!`: in zsh, `!` inside double quotes triggers history expansion. `Jwt:Key` must be at least 32 bytes or the API refuses to start. View your secrets with `dotnet user-secrets list`.

### 4. Run the API

```bash
cd backend/Api
dotnet run
```

The API listens on http://localhost:5047. On startup it creates the `Kanban` database if it doesn't exist and applies any pending migrations.

Verify the API and database connection: http://localhost:5047/api/health

### 5. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` and `/hubs` (SignalR) to the API on port 5047, so the browser stays on one origin and the auth cookie works without CORS.

Register an account, create a board and start adding columns and cards. To see real-time updates, open the same board in two tabs.

## API overview

All endpoints except the auth ones require login. `Api/Api.http` has ready-made requests.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `login`, `logout`, `forgot-password`, `reset-password`; `GET /api/auth/me` |
| Boards | `GET/POST /api/boards`; `GET/PATCH/DELETE /api/boards/{id}` (GET returns columns with their cards) |
| Members (owner only) | `GET/POST /api/boards/{id}/members`; `PATCH/DELETE /api/boards/{id}/members/{userId}`; `GET /api/boards/{id}/members/candidates?q=` (user search, 2+ characters) |
| Archive | `GET /api/boards/archived` (your restorable boards); `POST /api/boards/{id}/restore` |
| Long-term archive | `GET /api/boards/purged` (boards you owned when purged); `POST /api/boards/{id}/restore-purged` (moves it back to archived) |
| Columns | `POST /api/boards/{id}/columns`; `PATCH/DELETE /api/columns/{id}`; `POST /api/columns/{id}/move` |
| Cards | `POST /api/columns/{id}/cards`; `PATCH/DELETE /api/cards/{id}`; `POST /api/cards/{id}/move` |
| Real-time | SignalR hub at `/hubs/board` (`JoinBoard`; server pushes `BoardChanged`) |

Design notes:

- **Ordering:** columns and cards have gapped integer positions (1000, 2000, ...). A move sends "place after this sibling" and the server picks the position, renumbering a container only when the gap runs out.
- **Access control:** non-members get 404 (not 403) so board ids can't be probed. Viewers are read-only, editors can change cards, and only owners can manage columns, rename or delete the board, and manage members.
- **Members:** the last owner of a board can't be demoted or removed (409). User search is scoped to a board, owner-only, needs 2+ characters and returns at most 10 results, so the user list can't be dumped.
- **Archive:** restore is a single atomic update that succeeds only for an owner of an archived board still inside the 30-day window (`ArchivePolicy.RetentionDays`); everything else returns 404.
- **Purge:** the logic is in SQL (`dbo.PurgeArchivedBoards`, batched, one transaction per batch). `ArchivePurgeService` only schedules it: once at startup, then every 24 hours. `dbo.RestorePurgedBoard` reverses it for former owners, keeping original ids.
- **Real-time:** after every change the server pings the board's SignalR group and open pages refetch the board. The server stays the source of truth.

## Testing

Backend integration tests live in `backend/Api.Tests` (xUnit v3, Shouldly, Testcontainers, Respawn). They boot the real API in-process against a throwaway SQL Server container, so migrations and stored procedures are exercised for real. Docker must be running; `kanban-db` is not touched.

```bash
cd backend/Api.Tests && dotnet run      # or: cd backend && dotnet test
```

153 tests in two groups:

- **Integration** (`Integration/`, real API + SQL Server): registration and login, password reset (including rate limiting), boards, the owner/editor/viewer permission matrix, member management, cards, card and column ordering (including position renumbering), archive, purge and restore, and SignalR board pings.
- **Unit** (`Unit/`, no Docker needed, repositories mocked): role rules, claim parsing, JWT creation and validation, the SignalR notifier, the purge background service, and the auth, password reset, boards, columns and cards controllers.

Frontend tests use Vitest, React Testing Library and MSW (network-level API mocking) and need no backend:

```bash
cd frontend && npm test              # run once
npm run test:watch                   # watch mode
npm run test:coverage                # coverage report
```

132 tests cover the API client (errors, 401 handling), the auth provider and route guards, the SignalR hook (against a fake connection), every page (login, register, password reset, board list with archive and restore, board view with role-based controls, members dialog), the dialogs, and app routing. Drag and drop is left to the end-to-end suite because jsdom cannot simulate it.

Test plan, in order: backend integration (done) → backend unit tests (done) → frontend (done) → end-to-end regression (Playwright) → CI (GitHub Actions) with coverage reporting.

## Database migrations

Schema changes are versioned SQL scripts in `backend/Api/Migrations`, embedded in the assembly and applied in filename order by [DbUp](https://dbup.readthedocs.io/) at API startup. DbUp records applied scripts in the `SchemaVersions` table.

- Name scripts with a zero-padded number prefix, for example `0004_add_labels.sql`.
- Never edit a script that has already been applied. Add a new numbered script instead.
- If a script adds or changes a column on `Boards`, `Columns`, `Cards` or `BoardMembers`, make the same change to the matching `Deleted*` table and recreate `PurgeArchivedBoards` and `RestorePurgedBoard` (`CREATE OR ALTER`), or purge and restore will break.

Current scripts: `0001` users, `0002` password reset tokens, `0003` boards, board members, columns and cards, `0004` `Deleted*` archive tables and the purge/restore stored procedures. Roles (`owner`, `editor`, `viewer`) are enforced by a CHECK constraint from `0003`.

## Project structure

```
kanban/
├── backend/
│   ├── Kanban.slnx
│   ├── Api.Tests/         Integration/ and Unit/ tests (xUnit); Infrastructure/ holds fixtures
│   └── Api/
│       ├── Controllers/   Auth, password reset, boards, board members, columns, cards
│       ├── Data/          Connection factory, repositories, ordering logic, migration runner
│       ├── Dtos/          Request/response shapes with validation
│       ├── Hubs/          SignalR board hub
│       ├── Migrations/    Numbered DbUp SQL scripts
│       ├── Models/        Entities and query row shapes
│       ├── Services/      Tokens, email, rate limits, board change notifier, daily archive purge
│       └── Program.cs     Service registration, startup, health endpoint
└── frontend/
    └── src/
        ├── api/           fetch wrapper and API types
        ├── auth/          AuthProvider, useAuth, route guards
        ├── components/    shadcn/ui components and shared dialogs
        ├── lib/           Shared helpers, e.g. role descriptions
        ├── test/          Vitest setup, MSW server and render helpers (tests sit next to the code)
        ├── pages/         Login, register, password reset, board list, board view, members dialog
        └── realtime/      SignalR hook for live board updates
```

## Roadmap

Done:

- [x] Project scaffold (API, SQL Server in Docker, React/Vite)
- [x] DbUp migrations and `Users` table
- [x] JWT authentication (register, login, logout, httpOnly cookie)
- [x] Password reset by email (Mailpit locally) with rate limiting
- [x] Frontend auth pages (login, register, forgot and reset password)
- [x] Boards, columns and cards (schema, CRUD API, soft delete, board member roles)
- [x] Board list and board view UI
- [x] Drag-and-drop for cards and columns (dnd-kit)
- [x] Minimal UI restyle (Tailwind CSS + shadcn/ui)
- [x] Real-time board updates across tabs (SignalR)
- [x] Board member management with owner/editor/viewer roles
- [x] Archived-board restore (30-day window)
- [x] Daily purge job and long-term archive with restore

Up next:

- [x] Backend integration tests (xUnit, Testcontainers, Respawn)
- [x] Backend unit tests (NSubstitute)
- [x] Frontend tests (Vitest, React Testing Library, MSW)
- [ ] End-to-end regression tests (Playwright)
- [ ] CI pipeline (GitHub Actions) and coverage reporting

Later:

- [ ] Live updates on the board list page
- [ ] Presence indicators (who is viewing the board)
- [ ] Live cursors
- [ ] Granular SignalR events (patch state in place instead of refetching), if refetching ever feels slow

Deferred auth upgrades:

- [ ] Rate limit forgot-password per email (currently per IP only)
- [ ] Move rate-limit counters to Redis (or similar) so they survive restarts and work across instances
- [ ] Rate limit login
- [ ] Invalidate old login cookies after a password reset (per-user token version)
