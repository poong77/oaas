/**
 * .mjs dev 스크립트용 PG 연결 헬퍼 (db/connect.ts의 ESM 사촌).
 *
 * 사용:
 *   import { connectPg } from '../db/connect.mjs';
 *   const { pool, sql } = connectPg();
 *   const rows = await sql`SELECT 1`;
 *   ...
 *   await pool.end();
 *
 * `sql` 태그드 템플릿은 neon과 동일하게 "rows 배열"을 그대로 반환한다.
 */

import pkg from 'pg';
const { Pool } = pkg;

function shouldUseSsl(url) {
  if (/sslmode=require/i.test(url)) return true;
  if (/sslmode=disable/i.test(url)) return false;
  return process.env.NODE_ENV === 'production';
}

export function connectPg(url) {
  const connectionString = url ?? process.env.DATABASE_URL ?? '';
  if (!connectionString || connectionString.includes('placeholder')) {
    throw new Error('DATABASE_URL not configured (db/connect.mjs).');
  }
  const pool = new Pool({
    connectionString,
    ...(shouldUseSsl(connectionString)
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
    max: 4,
  });

  const sql = async (strings, ...values) => {
    let text = '';
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) text += `$${i + 1}`;
    }
    const result = await pool.query(text, values);
    return result.rows;
  };

  return { pool, sql };
}
