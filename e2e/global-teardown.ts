import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Removes the e2e SQL Server and Mailpit containers (and their data) once the run is over.
// Set KEEP_E2E_STACK=1 to keep them, which makes the next run ~15s faster (SQL Server's startup time).
export default function globalTeardown() {
  if (process.env.KEEP_E2E_STACK) {
    console.log('KEEP_E2E_STACK is set: leaving the e2e containers running (remove them with `npm run down`).')
    return
  }
  execFileSync('docker', ['compose', '-f', fileURLToPath(new URL('./docker-compose.yml', import.meta.url)), 'down', '-v'], { stdio: 'ignore' })
}
