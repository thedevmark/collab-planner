import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("Set DIRECT_URL or DATABASE_URL before running this script.");
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await pool.query('ALTER TABLE "Friend" ADD COLUMN IF NOT EXISTS "isSuggested" BOOLEAN NOT NULL DEFAULT false;');
  console.log("Column isSuggested added (or already existed).");
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
} finally {
  await pool.end();
}
