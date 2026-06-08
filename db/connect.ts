/**
 * Script용 PG 연결 헬퍼.
 *
 * 런타임(db/index.ts)은 전역 Pool을 lazy 재사용하지만,
 * 일회성 dev 스크립트(seed, migrate, backfill 등)는 자체 Pool을 만들고
 * 작업 끝에 `pool.end()`를 호출해야 깔끔히 종료된다.
 *
 * Neon HTTP 시절의 두 패턴을 모두 호환:
 *   1) drizzle(neon(url), { schema })           → connectPg(url).db
 *   2) const sql = neon(url); await sql`...`    → connectPg(url).sql
 *
 * `sql` 태그드 템플릿은 neon과 동일하게 "rows 배열"을 그대로 반환한다.
 */

import { Pool, type QueryResult } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type ScriptSqlTag = <T extends Record<string, unknown> = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<T[]>;

export interface ScriptDbHandle {
  pool: Pool;
  db: NodePgDatabase<typeof schema>;
  sql: ScriptSqlTag;
}

function shouldUseSsl(url: string): boolean {
  if (/sslmode=require/i.test(url)) return true;
  if (/sslmode=disable/i.test(url)) return false;
  return process.env.NODE_ENV === 'production';
}

/**
 * 스크립트용 PG 연결 생성. 호출자는 끝에 `pool.end()`를 호출해야 한다.
 *
 * @param url DATABASE_URL. 미지정 시 process.env.DATABASE_URL 사용.
 */
export function connectPg(url?: string): ScriptDbHandle {
  const connectionString = url ?? process.env.DATABASE_URL ?? '';
  if (!connectionString || connectionString.includes('placeholder')) {
    throw new Error(
      'DATABASE_URL not configured (db/connect.ts: connectPg).',
    );
  }
  const pool = new Pool({
    connectionString,
    ...(shouldUseSsl(connectionString)
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
    max: 4,
  });
  const db = drizzle(pool, { schema });

  const sql: ScriptSqlTag = async (strings, ...values) => {
    let text = '';
    for (let i = 0; i < strings.length; i++) {
      text += strings[i];
      if (i < values.length) text += `$${i + 1}`;
    }
    const result: QueryResult = await pool.query(text, values as unknown[]);
    return result.rows as never;
  };

  return { pool, db, sql };
}
