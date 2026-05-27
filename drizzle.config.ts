import type { Config } from 'drizzle-kit';

/**
 * drizzle-kit 설정.
 * Phase 0: DATABASE_URL이 비어있을 수 있으므로 실제 push/migrate는 사용자가
 * .env.local에 값을 채운 뒤에 실행한다.
 */
export default {
  schema: './db/schema/index.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://placeholder',
  },
  strict: true,
  verbose: true,
} satisfies Config;
