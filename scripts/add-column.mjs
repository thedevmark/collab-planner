import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgresql://postgres.zzphywcfcbpnujkuzqae:xKx8EwuwJVWXxOHz@aws-0-us-east-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

try {
  await pool.query('ALTER TABLE "Friend" ADD COLUMN IF NOT EXISTS "isSuggested" BOOLEAN NOT NULL DEFAULT false;');
  console.log('Column isSuggested added (or already existed).');
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
