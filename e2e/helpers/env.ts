// One place for the addresses of the isolated e2e stack (see docker-compose.yml and playwright.config.ts).
export const env = {
  webPort: 5273,
  webUrl: 'http://localhost:5273',
  apiUrl: 'http://localhost:5147',
  smtpPort: 1026,
  mailpitUrl: 'http://localhost:8026',
  db: { server: 'localhost', port: 14330, user: 'sa', password: 'E2e_Passw0rd!', database: 'KanbanE2E' },
  get connectionString() {
    const d = this.db
    return `Server=${d.server},${d.port};Database=${d.database};User Id=${d.user};Password=${d.password};TrustServerCertificate=True`
  },
}
