# Kanban
 
A mini Trello-style Kanban board built with ASP.NET Core, SQL Server and React.
 
**Status:** in development. The project scaffold, database migrations and API/database health check are in place; features are being added incrementally (see [Roadmap](#roadmap)).
 
## Tech stack
 
| Layer | Technology |
|---|---|
| Backend | ASP.NET Core Web API (.NET 10) |
| Data access | Dapper + Microsoft.Data.SqlClient (no EF Core) |
| Database | SQL Server 2022 (Docker) |
| Migrations | DbUp (versioned SQL scripts) |
| Frontend | React + TypeScript, built with Vite |
 
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
 
### 2. Start SQL Server
 
```bash
docker run -d --name kanban-db --platform linux/amd64 \
  -e ACCEPT_EULA=Y -e 'MSSQL_SA_PASSWORD=YourStrong!Passw0rd' \
  -p 1433:1433 -v kanban-data:/var/opt/mssql \
  mcr.microsoft.com/mssql/server:2022-latest
```
 
On later runs, start the existing container with `docker start kanban-db`.
 
### 3. Configure the connection string
 
The connection string is stored with [.NET user secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets), not in the repository. From `backend/Api`:
 
```bash
dotnet user-secrets set 'ConnectionStrings:Default' 'Server=localhost,1433;Database=Kanban;User Id=sa;Password=YourStrong!Passw0rd;TrustServerCertificate=True'
```
 
Use single quotes: in zsh, `!` inside double quotes triggers history expansion.
 
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
 
Open http://localhost:5173. Vite proxies `/api` requests to the API on port 5047.
 
## Database migrations
 
Schema changes are versioned SQL scripts in `backend/Api/Migrations`, embedded in the assembly and applied in filename order by [DbUp](https://dbup.readthedocs.io/) at API startup. DbUp records applied scripts in the `SchemaVersions` table.
 
- Name scripts with a zero-padded number prefix, for example `0002_create_boards.sql`.
- Never edit a script that has already been applied. Add a new numbered script instead.
## Project structure
 
```
kanban/
├── backend/
│   └── Api/
│       ├── Data/          Connection factory and migration runner
│       ├── Migrations/    Numbered DbUp SQL scripts
│       └── Program.cs     Service registration, startup, health endpoint
└── frontend/              Vite + React + TypeScript app
```
 
## Roadmap
 
- [x] Project scaffold (API, SQL Server in Docker, React/Vite)
- [x] DbUp migrations and `Users` table
- [x] JWT authentication
- [ ] Front end pages for login and password resets
- [ ] Boards, columns and cards (schema and CRUD API)
- [ ] Drag-and-drop board UI
- [ ] Real-time updates across tabs (SignalR)
- [ ] Production deployment