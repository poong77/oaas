/**
 * 공지 노출 종료시각 타임존 보정 (1회성).
 *
 * 배경:
 *   기존 코드는 `<input type="datetime-local">` 값('YYYY-MM-DDTHH:mm', 오프셋 없음)을
 *   서버에서 `new Date(iso)`로 파싱했다. Vercel 서버 TZ가 UTC라 관리자가 입력한
 *   한국시간(KST)이 그대로 UTC로 저장 → 실제 만료가 9시간 늦게 동작.
 *   (예: KST 07:54 의도 → 07:54 UTC 저장 = KST 16:54 까지 노출)
 *
 *   코드는 parseKstDateTimeLocal/kstDateTimeLocal 로 수정 완료.
 *   이 스크립트는 그 이전에 저장된 기존 데이터를 -9h 보정한다.
 *
 * 대상: notices.popup_until, notices.banner_until (NULL 제외).
 *   - 모든 값이 동일하게 9시간 밀려 저장되었으므로 일괄 -9h.
 *
 * 실행:
 *   - 미리보기(기본): `tsx db/fix-notice-until-tz.ts`
 *   - 실제 반영      : `tsx db/fix-notice-until-tz.ts --apply`
 *
 * ⚠️ 1회성: --apply 를 두 번 실행하면 18시간이 빠진다. 한 번만 적용할 것.
 */

import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

import { sql } from 'drizzle-orm';

import { connectPg } from './connect';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const APPLY = process.argv.includes('--apply');
const SHIFT = "interval '9 hours'";

function fmtKst(d: Date | null): string {
  if (!d) return '(무기한/없음)';
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }) + ' KST';
}

async function main() {
  if (!DATABASE_URL.startsWith('postgres')) {
    console.error('❌ DATABASE_URL 미설정. 중단.');
    process.exit(1);
  }
  const { db } = connectPg(DATABASE_URL);

  // 보정 대상 미리보기 (현재값 / 보정 후 예상값)
  const rows = (await db.execute(sql`
    SELECT
      id,
      title,
      popup_enabled,
      banner,
      popup_until,
      (popup_until - ${sql.raw(SHIFT)})  AS popup_until_fixed,
      banner_until,
      (banner_until - ${sql.raw(SHIFT)}) AS banner_until_fixed
    FROM notices
    WHERE popup_until IS NOT NULL OR banner_until IS NOT NULL
    ORDER BY created_at DESC
  `)) as unknown as {
    rows: Array<{
      id: string;
      title: string;
      popup_enabled: boolean;
      banner: boolean;
      popup_until: string | null;
      popup_until_fixed: string | null;
      banner_until: string | null;
      banner_until_fixed: string | null;
    }>;
  };

  const list = rows.rows ?? (rows as unknown as typeof rows.rows);

  console.log(`\n대상 공지: ${list.length}건\n`);
  for (const r of list) {
    console.log(`• ${r.title}  [${r.id.slice(0, 8)}]`);
    if (r.popup_until) {
      console.log(
        `    팝업 종료  ${fmtKst(new Date(r.popup_until))}  →  ${fmtKst(
          new Date(r.popup_until_fixed as string),
        )}${r.popup_enabled ? '' : '  (popup 비활성)'}`,
      );
    }
    if (r.banner_until) {
      console.log(
        `    티커 종료  ${fmtKst(new Date(r.banner_until))}  →  ${fmtKst(
          new Date(r.banner_until_fixed as string),
        )}${r.banner ? '' : '  (banner 비활성)'}`,
      );
    }
  }

  if (!APPLY) {
    console.log('\n👀 미리보기 모드. 실제 반영하려면 `-- --apply` 추가.\n');
    return;
  }

  const res = (await db.execute(sql`
    UPDATE notices
    SET
      popup_until  = CASE WHEN popup_until  IS NOT NULL THEN popup_until  - ${sql.raw(SHIFT)} ELSE NULL END,
      banner_until = CASE WHEN banner_until IS NOT NULL THEN banner_until - ${sql.raw(SHIFT)} ELSE NULL END,
      updated_at = now()
    WHERE popup_until IS NOT NULL OR banner_until IS NOT NULL
  `)) as unknown as { rowCount?: number };

  console.log(`\n✅ 적용 완료: ${res.rowCount ?? list.length}건 -9h 보정.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
