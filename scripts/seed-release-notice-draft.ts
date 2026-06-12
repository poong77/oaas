/**
 * OA서포트 정식 오픈 릴리즈 공지를 "초안(draft)"으로 1건 등록한다.
 *
 *   - kind = 'release', published_at = null (초안 → 사용자 비노출, 어드민 목록에서만 보임)
 *   - 작성자(author_id)는 활성 admin 계정 중 하나로 연결
 *   - 동일 제목의 초안이 이미 있으면 재생성하지 않음(멱등)
 *
 * 실행:
 *   npx tsx scripts/seed-release-notice-draft.ts            # dry-run (미삽입, 미리보기)
 *   npx tsx scripts/seed-release-notice-draft.ts --commit   # 실제 초안 등록
 *
 * 주의: 로컬 .env.local 의 DATABASE_URL 은 운영 DB(oaas_prd)를 가리킨다.
 *       이 스크립트는 초안만 추가하며 파괴적 작업은 하지 않는다.
 */
import { config } from 'dotenv';
import { and, eq, isNull } from 'drizzle-orm';
import { connectPg } from '../db/connect';

// .env.local 우선 → .env 보충 (먼저 적재된 값은 덮어쓰지 않음)
config({ path: '.env.local' });
config();

import { notices } from '../db/schema/notices';
import { users } from '../db/schema/users';

const COMMIT = process.argv.includes('--commit');

const TITLE = '[릴리즈 안내] OA서포트 정식 오픈 — 매뉴얼 검색부터 이슈 접수까지 한 곳에서';

const BODY = `> **OA 솔루션 호텔리어를 위한 통합 지원 허브, OA서포트가 정식 오픈했습니다.**
> 흩어져 있던 매뉴얼 검색·직접 해결·이슈 접수를 한 곳으로 모았습니다.

안녕하세요, OA테크입니다.

그동안 제품 매뉴얼은 도움말 사이트에서, AS 접수는 별도 페이지에서, 급한 문의는 전화·메신저로 — 지원 창구가 여러 곳에 흩어져 있어 불편하셨을 겁니다.

이제 호텔리어 여러분을 위한 통합 지원 허브 **OA서포트(support.oapms.com)** 를 정식 오픈합니다. PMS·CMS·키리스·키오스크·웹서비스 등 **모든 OA 솔루션의 지원을 한 화면에서** 받으실 수 있습니다.

---

## 이번 릴리즈에서 새로워진 점

### 1. 똑똑한 AI 검색으로 직접 해결
"체크인 시간이 안 바뀌어요"처럼 평소 말투로 검색해도, 관련 가이드와 FAQ를 정확히 찾아드립니다. 입력하는 동안 실시간으로 결과가 표시되고, 스크롤만 내리면 계속 이어집니다. 문의 전에 직접 답을 찾는 **셀프픽스** 경험을 제공합니다.

### 2. 이슈 접수와 처리 현황을 한눈에
해결이 어려운 문제는 바로 접수하실 수 있고, **접수 → 처리 중 → 답변 → 완료**까지 진행 상태가 실시간으로 추적됩니다. "내 문의 지금 어떻게 됐지?"를 다시 여쭤보실 필요가 없습니다. 과거 문의 이력도 그대로 보존되어 언제든 다시 확인하실 수 있습니다.

### 3. 우리 숙소 직원 계정, 직접 관리
호텔 담당자께서 직접 직원 계정을 추가·관리하실 수 있습니다. 입·퇴사가 잦은 현장 환경에 맞춰, 매번 OA에 요청하지 않고도 권한을 정리하실 수 있습니다. 우리 호텔이 이용 중인 솔루션 현황도 마이페이지에서 한눈에 확인됩니다.

### 4. 알림은 받으시던 채널 그대로
처리 결과와 공지 사항을 이메일·문자로 받아보시고, 받으신 내역은 사이트 내 **메시지함**에 모아 보관됩니다. 놓친 안내가 없는지 한 곳에서 다시 확인하실 수 있습니다.

---

## 한눈에 보는 변화

| 이런 상황에서 | 기존 | OA서포트 |
| --- | --- | --- |
| 사용법이 궁금할 때 | 도움말 사이트 따로 검색 | AI 검색으로 즉시, 한 화면에서 |
| 문제가 생겼을 때 | 전화·메신저, 연결 대기 | 직접 해결 → 안 되면 바로 접수 |
| 접수한 다음 | "처리됐나?" 다시 문의 | 상태 실시간 추적 |
| 직원 권한 변경 | OA에 요청 | 담당자가 직접 관리 |

---

## 이렇게 이용하세요

1. **검색한다** — 평소 말투로 검색하면 관련 가이드·FAQ가 바로 표시됩니다.
2. **직접 해결한다** — 안내를 따라 그 자리에서 셀프픽스합니다.
3. **안 되면 접수한다** — 접수폼으로 끊김 없이 이슈를 등록합니다.
4. **결과를 확인한다** — 진행 상태 추적과 메일·문자·메시지함 알림으로 끝까지 챙겨드립니다.

기존 호텔리어 고객님께서는 **사용하시던 계정 그대로** 로그인하실 수 있습니다.

👉 지금 **[support.oapms.com](https://support.oapms.com)** 에서 만나보세요.

앞으로도 더 빠르고 편리한 지원으로 보답하겠습니다. 이용 중 불편한 점이나 제안하실 내용이 있으시면 언제든 이슈로 접수해 주세요.

감사합니다.

**OA테크 드림**`;

async function main() {
  const { pool, db } = connectPg();
  try {
    // 작성자: 활성 admin 1명
    const [admin] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.isActive, true)))
      .limit(1);

    if (!admin) {
      console.error('❌ 활성 admin 계정을 찾지 못했습니다. author_id 없이 진행하려면 스크립트를 조정하세요.');
      return;
    }

    // 중복 초안 방지
    const [dupe] = await db
      .select({ id: notices.id })
      .from(notices)
      .where(
        and(
          eq(notices.title, TITLE),
          eq(notices.kind, 'release'),
          isNull(notices.publishedAt),
          eq(notices.isActive, true),
        ),
      )
      .limit(1);

    console.log('────────────────────────────────────────');
    console.log('작성자(author):', admin.name, `<${admin.email ?? '-'}>`, admin.id);
    console.log('kind          : release');
    console.log('상태          : draft (published_at = null)');
    console.log('제목          :', TITLE);
    console.log('본문 길이     :', BODY.length, '자');
    console.log('────────────────────────────────────────');

    if (dupe) {
      console.log(`ℹ️  동일 제목의 초안이 이미 존재합니다 (id=${dupe.id}). 재생성하지 않습니다.`);
      console.log(`   편집: /admin/notices/${dupe.id}`);
      return;
    }

    if (!COMMIT) {
      console.log('🟡 DRY-RUN — 실제 삽입하지 않았습니다. 등록하려면 --commit 플래그를 붙이세요.');
      return;
    }

    const [created] = await db
      .insert(notices)
      .values({
        kind: 'release',
        title: TITLE,
        bodyMarkdown: BODY,
        productCode: null,
        pinned: false,
        banner: false,
        publishedAt: null, // 초안
        authorId: admin.id,
      })
      .returning({ id: notices.id });

    console.log(`✅ 초안 등록 완료 — id=${created.id}`);
    console.log(`   편집/발행: /admin/notices/${created.id}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
