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
- `docker start kanban-db`
- `cd backend/Api && dotnet run` (http://localhost:5047)
- `cd frontend && npm run dev` (http://localhost:5173)

## Planned
JWT auth, boards/columns/cards CRUD, drag and drop (dnd-kit), real-time updates (SignalR), production deployment.

## Notes
- Users table exists (migration 0001).
- Shell is zsh: single-quote any string containing `!`.