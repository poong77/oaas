import { connectPg } from '../db/connect.mjs';

const { sql, pool } = connectPg(process.env.DATABASE_URL);
try {
  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  console.log('OK: dropped public');
  await sql`CREATE SCHEMA public`;
  console.log('OK: recreated public');
  await sql`GRANT ALL ON SCHEMA public TO public`;
  console.log('OK: granted public');
} finally {
  await pool.end();
}
