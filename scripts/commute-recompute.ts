// Manual/cron entry point for the commute grid recompute, without going through HTTP.
// Usage: npx tsx scripts/commute-recompute.ts
import { randomUUID } from 'node:crypto';
import { initCommuteJob } from '@/lib/commute/db';
import { runCommuteRecompute } from '@/lib/commute/recompute';

async function main() {
  const jobId = randomUUID();
  await initCommuteJob(jobId);
  console.log(`Job ${jobId} gestartet…`);
  await runCommuteRecompute(jobId);
  console.log(`Job ${jobId} abgeschlossen.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
