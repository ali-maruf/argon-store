// Local development Postgres (no Docker needed). Production uses Supabase/Neon.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = "./.pgdata";
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "argon", password: "argon", port: 5433, persistent: true, initdbFlags: ["--encoding=UTF8", "--locale=C"] });
if (!existsSync(dir)) await pg.initialise();
await pg.start();
try { await pg.createDatabase("argon"); } catch {}
console.log("Postgres ready: postgresql://argon:argon@localhost:5433/argon");
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop); process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
