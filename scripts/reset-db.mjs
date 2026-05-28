import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);
await sql`DROP SCHEMA IF EXISTS public CASCADE`;
console.log('OK: dropped public');
await sql`CREATE SCHEMA public`;
console.log('OK: recreated public');
await sql`GRANT ALL ON SCHEMA public TO public`;
console.log('OK: granted public');
await sql`GRANT ALL ON SCHEMA public TO neondb_owner`;
console.log('OK: granted neondb_owner');
