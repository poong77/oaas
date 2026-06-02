/**
 * 임시 진단 스크립트 — 검색로그 중복 행 점검.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

async function main() {
  const { sql } = await import('drizzle-orm');
  const { db } = await import('../index');
  if (!db) {
    console.log('DB 미설정');
    return;
  }

  // 서버(now) 시각
  const nowRes = await db.execute(sql`select now() as now`);
  console.log('DB now():', ((nowRes as any).rows ?? nowRes)[0].now);

  // 오늘 도어락/체크인 등 최근 행 raw (ms + session_key)
  const raw = await db.execute(sql`
    select
      to_char(created_at, 'MM-DD HH24:MI:SS.MS') as ts,
      query,
      session_key,
      product_code,
      total_results
    from search_logs
    where created_at > now() - interval '12 hours'
    order by created_at desc
    limit 40
  `);
  console.log('=== 최근 12시간 raw ===');
  console.table(
    ((raw as any).rows ?? raw).map((r: any) => ({
      ts: r.ts,
      query: r.query,
      session: r.session_key ?? '(null)',
      product: r.product_code ?? '-',
      n: r.total_results,
    })),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
