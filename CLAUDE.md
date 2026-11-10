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

## Planned
Done: JWT auth, boards/columns/cards CRUD, drag and drop (dnd-kit), real-time board updates (SignalR hub `/hubs/board`, "BoardChanged" ping then refetch).
Next: board member management (admin/member roles), then archived-board restore, then purge job (see below), then production deployment.

## Later (decided to do later)
- Retrieve archived boards (restore soft-deleted boards; admin only; only possible before the 30-day purge).
- Daily SQL job: permanently purge boards archived >30 days. Moves rows from Boards/Columns/Cards into DeletedBoards/DeletedColumns/DeletedCards, then removes them from live tables. Do before prod deploy.
- Board member management: invite/add members and change roles (BoardMembers table and roles already exist; only the owner row is created today).
- Live updates on the board list page (new/renamed/deleted boards appear without a refresh).
- Presence indicators (avatars of who is viewing the board right now).
- Live cursors (see collaborators' pointers and drags in real time).
- Granular SignalR events (patch state in place) instead of "BoardChanged, refetch" if refetching ever feels slow.

## Deferred auth upgrades (decided to do later)
- Rate limit forgot-password per email (currently per IP only, built-in ASP.NET limiter, in-memory).
- Move rate-limit counters to Redis (or similar) so they survive restarts and work across instances.
- Rate limit login (not limited yet).
- Invalidate old login cookies after a password reset (JWTs stay valid up to 60 min). Fix: per-user token version checked on each request.

## Notes
- Users table exists (migration 0001).
- Shell is zsh: single-quote any string containing `!`.
- Respond with brief and sharp points. Do not over explain process unless explicitly asked for. 