/**
 * Puts back a student deleted with "Permanently delete (with backup)", from
 * the backup file the owner downloaded. Not part of the build: run it once,
 * on purpose, against the right database:
 *
 *   npx tsx scripts/restore-student-backup.ts path/to/xello-backup-XEL-2026-012-2026-10-10.json
 *
 * Rows that already exist are skipped, so running it twice changes nothing.
 */
import { readFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";
import { StudentBackup, restoreStudentBackup } from "../src/lib/services/student-purge";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npx tsx scripts/restore-student-backup.ts <backup.json>");
  process.exit(1);
}
const backup = JSON.parse(readFileSync(file, "utf8")) as StudentBackup;
restoreStudentBackup(backup, "Restore script")
  .then((restored) => console.log(`▶ Restored ${backup.student.studentCode} (${backup.student.name}):`, restored))
  .catch((e) => {
    console.error("Restore failed; nothing was changed:", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
