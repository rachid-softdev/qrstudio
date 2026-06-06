import { PgBoss } from "pg-boss"

let boss: PgBoss | null = null

export async function getQueue(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL!)
    await boss.start()
  }
  return boss
}

export const QUEUE_NAMES = {
  RECORD_SCAN: "record-scan",
  AGGREGATE_SCANS: "aggregate-scans",
  RETENTION_CLEANUP: "retention-cleanup",
  CLEANUP_TRASH: "cleanup-trash",
} as const
