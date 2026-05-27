import 'dotenv/config';
import type { Config } from 'drizzle-kit';

/**
 * drizzle-kit 설정.
 * Phase 1: DATABASE_URL이 placeholder여도 generate는 동작 (SQL 파일만 생성).
 *          push/migrate는 실제 URL 받은 뒤 사용자가 직접 실행.
 */
export default {
  schema: './db/schema',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder',
  },
  strict: true,
  verbose: true,
} satisfies Config;
