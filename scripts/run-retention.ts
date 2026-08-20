import "dotenv/config";
import { runRetentionJob } from "@/lib/retention/run";

const result = await runRetentionJob();
process.stdout.write(`${JSON.stringify(result)}\n`);
