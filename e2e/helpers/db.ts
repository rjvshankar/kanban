// Direct database access for the few things the UI cannot do: time travel for the purge job.
// Uses sqlcmd inside the e2e SQL Server container, so no Node SQL driver is needed.
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { env } from './env'

const run = promisify(execFile)
const composeFile = fileURLToPath(new URL('../docker-compose.yml', import.meta.url))

async function sql(statement: string): Promise<string> {
  const { stdout } = await run('docker', [
    'compose', '-f', composeFile, 'exec', '-T', 'db',
    '/opt/mssql-tools18/bin/sqlcmd', '-C', '-b', '-S', 'localhost', '-U', env.db.user, '-P', env.db.password, '-d', env.db.database,
    '-Q', statement,
  ])
  return stdout
}

/** Pretends the board was deleted `days` days ago. */
export const ageDeletedBoard = (boardId: number, days: number) =>
  sql(`UPDATE dbo.Boards SET DeletedAt = DATEADD(day, -${Math.trunc(days)}, SYSUTCDATETIME()) WHERE Id = ${Math.trunc(boardId)}`)

/** Runs the same stored procedure the daily background job runs. */
export const runPurge = () => sql('EXEC dbo.PurgeArchivedBoards @RetentionDays = 30')
