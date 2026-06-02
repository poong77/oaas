/**
 * AS 사용자 스크래핑 — as.oapms.com `user/list.do` + `user/view.do` → db/data/oa-as-users.json
 *
 * 출처: as.oapms.com 사용자 목록(총 401건, 20건/페이지).
 *   - 로그인: POST /login.ajax (user_id, user_pass) → JSESSIONID 세션 쿠키.
 *   - 목록(list.do?page=N): ID / 이름 / 업체 / 등급(라벨) / 사용여부.
 *   - 상세(view.do?user_id=X): user_email, user_phone, user_comp(data-selected=compKey).
 *   - compKey 는 hotels 이관 시 note 마커 `[AS이관 comp_key=NNN]` 와 동일 → 정확 매핑.
 *
 * 실행: AS_USER=lsj AS_PASS=123456 npx tsx db/scrape-as-users.ts
 *   - 결과: db/data/oa-as-users.json (멱등 — 매 실행 전체 재수집·덮어쓰기).
 *   - 자격증명은 env 로만 전달. 코드/파일에 저장하지 않음.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://as.oapms.com';
const USER = process.env.AS_USER ?? '';
const PASS = process.env.AS_PASS ?? '';

type ScrapedUser = {
  userId: string; // 로그인 ID (이메일 또는 아이디)
  name: string; // 이름(사용자)
  company: string; // 업체명 (목록)
  level: string; // 등급 라벨 (예: 업체담당자)
  status: string; // 사용 | 미사용
  email: string; // 상세 user_email (없으면 '')
  phone: string; // 상세 user_phone (없으면 '')
  compKey: string; // 상세 user_comp data-selected (hotels comp_key 매핑용)
};

let cookie = '';

function mergeCookie(setCookie: string | null) {
  if (!setCookie) return;
  // "JSESSIONID=xxx; Path=/; HttpOnly" → JSESSIONID=xxx
  const m = setCookie.match(/JSESSIONID=[^;]+/);
  if (m) cookie = m[0];
}

async function get(path: string): Promise<string> {
  const res = await fetch(BASE + path, {
    headers: cookie ? { Cookie: cookie } : {},
  });
  mergeCookie(res.headers.get('set-cookie'));
  return res.text();
}

async function login() {
  // 세션 프라임 (JSESSIONID 발급)
  await get('/index.do');
  const body = new URLSearchParams({ user_id: USER, user_pass: PASS });
  const res = await fetch(BASE + '/login.ajax', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: BASE + '/index.do',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body.toString(),
  });
  mergeCookie(res.headers.get('set-cookie'));
  const text = await res.text();
  // 성공 시 {} 반환. 에러 시 error_message 포함.
  if (text.includes('error_message') || text.includes('XX_X_')) {
    throw new Error(`로그인 실패: ${text.slice(0, 200)}`);
  }
  console.log('🔑 로그인 성공');
}

/** 목록 한 페이지 파싱 → 행 배열 */
function parseListRows(html: string): Array<{
  userId: string;
  name: string;
  company: string;
  level: string;
  status: string;
}> {
  const rows: ReturnType<typeof parseListRows> = [];
  const trRe =
    /<tr class="viewBtn" data-user_id="([^"]*)">([\s\S]*?)<\/tr>/g;
  let m: RegExpExecArray | null;
  while ((m = trRe.exec(html))) {
    const userId = decodeHtml(m[1]!);
    const tds = [...m[2]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((x) =>
      decodeHtml(x[1]!.replace(/<[^>]*>/g, '').trim()),
    );
    // 컬럼: [ID, 사용자(이름), 업체, 등급, 사용여부]
    // 단, 업체 셀이 조건부로 2개 렌더되는 케이스 보정: 마지막 2개가 등급/사용여부
    const status = tds[tds.length - 1] ?? '';
    const level = tds[tds.length - 2] ?? '';
    const name = tds[1] ?? '';
    const company = tds[2] ?? '';
    rows.push({ userId, name, company, level, status });
  }
  return rows;
}

function totalCount(html: string): number {
  const m = html.match(/총\s*:\s*([0-9,]+)\s*건/);
  return m ? Number(m[1]!.replace(/,/g, '')) : 0;
}

function attrValue(html: string, name: string): string {
  // <input ... name="user_email" value="xxx" ...>
  const re = new RegExp(
    `name="${name}"[^>]*?value="([^"]*)"|value="([^"]*)"[^>]*?name="${name}"`,
  );
  const m = html.match(re);
  return decodeHtml((m?.[1] ?? m?.[2] ?? '').trim());
}

function compKeyOf(html: string): string {
  // <select name="user_comp" data-selected="364">
  const m = html.match(/name="user_comp"[^>]*data-selected="([^"]*)"/);
  return (m?.[1] ?? '').trim();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

async function main() {
  if (!USER || !PASS) {
    console.error('❌ AS_USER / AS_PASS env 필요.');
    process.exit(1);
  }
  await login();

  // 1) 목록 전체 페이지 수집
  const first = await get('/user/list.do?page=1');
  const total = totalCount(first);
  const pageSize = 20;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  console.log(`📋 총 ${total}건 / ${pages}페이지`);

  const listRows = parseListRows(first);
  for (let p = 2; p <= pages; p++) {
    const html = await get(`/user/list.do?page=${p}`);
    listRows.push(...parseListRows(html));
    if (p % 5 === 0) console.log(`  …목록 ${p}/${pages}페이지`);
  }
  console.log(`📋 목록 수집: ${listRows.length}건`);

  // 2) 상세 수집 (email/phone/compKey)
  const out: ScrapedUser[] = [];
  let i = 0;
  for (const r of listRows) {
    i++;
    const html = await get(
      `/user/view.do?user_id=${encodeURIComponent(r.userId)}`,
    );
    out.push({
      userId: r.userId,
      name: attrValue(html, 'user_name') || r.name,
      company: r.company,
      level: r.level,
      status: r.status,
      email: attrValue(html, 'user_email'),
      phone: attrValue(html, 'user_phone'),
      compKey: compKeyOf(html),
    });
    if (i % 25 === 0) console.log(`  …상세 ${i}/${listRows.length}건`);
  }

  const path = join(import.meta.dirname, 'data', 'oa-as-users.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf-8');

  // 요약 통계
  const noEmail = out.filter((u) => !u.email).length;
  const noComp = out.filter((u) => !u.compKey).length;
  const inactive = out.filter((u) => u.status !== '사용').length;
  const levels = [...new Set(out.map((u) => u.level))];
  console.log(`\n✅ 저장 완료: ${out.length}건 → ${path}`);
  console.log(`   - 이메일 없음: ${noEmail}건`);
  console.log(`   - 업체(compKey) 없음: ${noComp}건`);
  console.log(`   - 미사용(비활성): ${inactive}건`);
  console.log(`   - 등급 종류: ${levels.join(', ')}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('스크래핑 실패:', err);
  process.exit(1);
});
