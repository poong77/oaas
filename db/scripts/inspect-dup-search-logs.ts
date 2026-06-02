/**
 * 임시 진단 스크립트 — 검색로그 중복 행 점검.
 * 같은 query가 같은 초(second) 안에 2건 이상 들어왔는지 본다.
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
  const dups = await db.execute(sql`
    select
      to_char(date_trunc('second', created_at), 'MM-DD HH24:MI:SS') as sec,
      query,
      session_key,
      count(*) as n,
      array_agg(extract(milliseconds from created_at)::int order by created_at) as ms
    from search_logs
    where created_at > now() - interval '3 days'
    group by date_trunc('second', created_at), query, session_key
    having count(*) > 1
    order by date_trunc('second', created_at) desc
    limit 40
  `);
  const rows = (dups as any).rows ?? dups;
  console.log('=== 같은 초에 2건 이상 (중복 의심) ===');
  console.table(
    rows.map((r: any) => ({
      sec: r.sec,
      query: r.query,
      session: r.session_key ?? '(null)',
      n: Number(r.n),
      ms: Array.isArray(r.ms) ? r.ms.join('/') : r.ms,
    })),
  );

  const t = await db.execute(sql`
    select count(*)::int as total,
           count(distinct (date_trunc('second', created_at), query))::int as distinct_sec_query
    from search_logs
    where created_at > now() - interval '3 days'
  `);
  const tr = ((t as any).rows ?? t)[0];
  console.log('최근 3일 총 로그:', tr.total, '/ (초+query) 유니크:', tr.distinct_sec_query);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
