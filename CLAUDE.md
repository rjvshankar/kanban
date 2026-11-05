# Kanban

Mini Trello-style Kanban board.

## Stack
- Backend: ASP.NET Core Web API (.NET 10, controllers) in `backend/Api`. Dapper + Microsoft.Data.SqlClient. No EF Core.
- Data access: `IDbConnectionFactory` in `Data/`; repositories open one connection per method.
- Database: SQL Server 2022 in Docker (container `kanban-db`, database `Kanban`, port 1433).
- Migrations: DbUp. Numbered scripts in `backend/Api/Migrations` (embedded resources), run at API startup.
  Never edit an applied script; add a new numbered one.
- Frontend: Vite + React + TypeScript + ESLint in `frontend/`. Vite proxies `/api` to http://localhost:5047.
- Connection string lives in dotnet user-secrets (`ConnectionStrings:Default`), not in the repo.

## Run
- `docker start kanban-db kanban-mailpit` (Mailpit: fake SMTP on 1025, inbox UI at http://localhost:8025)
- `cd backend/Api && dotnet run` (http://localhost:5047)
- `cd frontend && npm run dev` (http://localhost:5173)

## Planned
JWT auth, boards/columns/cards CRUD, drag and drop (dnd-kit), real-time updates (SignalR), production deployment.

## Deferred auth upgrades (decided to do later)
- Rate limit forgot-password per email (currently per IP only, built-in ASP.NET limiter, in-memory).
- Move rate-limit counters to Redis (or similar) so they survive restarts and work across instances.
- Rate limit login (not limited yet).
- Invalidate old login cookies after a password reset (JWTs stay valid up to 60 min). Fix: per-user token version checked on each request.

## Notes
- Users table exists (migration 0001).
- Shell is zsh: single-quote any string containing `!`.