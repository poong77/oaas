# 8_OA_AS 이관 — 이전 개발자분께 협조 요청 (2026-06)

> support.oapms.com (통합AS 플랫폼) 운영을 Vercel에서 자체 호스팅으로 이관 중입니다.
> 이전 개발 환경 정보 공유와 별개로 몇 가지 확인·재작업을 부탁드립니다.

---

## 1. 현재 진행 상태

### 완료
- AWS 인프라 (EC2 + Docker PostgreSQL 16 + pgvector + S3 + IAM Role + SSM Parameter Store)
- Gitea + Jenkins + n8n 기반 CI/CD 파이프라인 (push → 자동 빌드·배포·Slack 알림)
- Neon → 자체 PG 데이터 이관 대부분 (users 418, articles 147, faqs 88, tickets 21 등)
- 임시 도메인 `https://support2.oapms.com` 으로 테스트 운영 중
- 코드 베이스 정리: Vercel 의존성 제거 (`@neondatabase/serverless` → `pg`, `@vercel/blob` → `@aws-sdk/client-s3`, `vercel.json` 삭제, Next.js standalone 빌드)

### 진행 중 / 대기
- **A. hotels 및 hotel_solution_links 데이터 재이관** ← 협조 요청 ①
- **C. OA SSO 실제 사용 여부 확인** ← 협조 요청 ②

---

## 2. 협조 요청 ① — hotels 관련 schema 차이 정리

### 문제

Neon DB의 schema가 git repo의 db/schema와 일부 컬럼·테이블에서 차이가 있어 데이터 이관 실패.

**git repo에는 없는데 Neon에만 있는 항목**:

```
hotels 테이블 추가 컬럼 (8개):
  - representative_name        text
  - corporate_name             text
  - hotel_type                 (enum)  ← 별도 타입 정의
  - contract_year              integer
  - contract_month             integer
  - slack_id                   text
  - extra_contacts             jsonb DEFAULT '[]'
  - extra_emails               jsonb DEFAULT '[]'

hotel_solution_links 테이블 추가 컬럼 (3개):
  - preset_id                  uuid
  - login_id                   text
  - password_enc               text

hotel_managed_links — 테이블 전체 (git repo에 없음)
  - 컬럼: id, created_at, updated_at, is_active, hotel_id, linked_hotel_id
```

### 추가로 확인된 사실
- repo 전체 코드에서 위 컬럼·테이블 어디에도 참조 없음 (TypeScript/SQL/마이그레이션 파일 다 확인)
- 따라서 schema에만 추가되고 코드 연결이 안 됐거나, 이후 우리 brand에서 제거된 잔재로 추정

### 부탁드릴 것
다음 중 **상황에 맞는 것 한 가지** 정리 후 회신 부탁드립니다.

| 케이스 | 어떻게 진행할지 |
|---|---|
| **(A) 이 컬럼·테이블이 의미 있는 데이터를 담고 있음** | 1) repo의 `db/schema/`에 누락된 정의 추가 PR 만들어주시거나 (없으시면 우리가 추가), 2) Neon에서 어떤 비즈니스 로직에서 썼는지 간략 설명 |
| **(B) 의미 없는 잔재 — 데이터 손실 OK** | 위 컬럼·테이블 Neon에서 DROP 해주시면 우리 측에서 전체 dump 다시 받아 이관 마무리. SQL은 본 문서 §5 참조 |
| **(C) 일부만 필요, 일부 잔재** | 어느 게 필요/불필요한지 알려주시면 우리 schema에 필요한 것만 반영 + Neon에서 나머지 DROP |

### 가능 시점 알려주시면 거기 맞춰 이관 완료 일정 잡습니다

---

## 3. 협조 요청 ② — OA SSO 사용 여부 확인

이전 환경 .env에 `AUTH_DEV_STUB=true`였고 OA_SSO_* 키가 없었습니다.

### 확인 부탁드릴 항목
1. 운영 중 OA SSO (oapms.com 통합 로그인)을 **실제로 연동해서 쓰고 있었나요?**
   - YES: OA_SSO_CLIENT_ID / SECRET / ISSUER 값 + 콜백 URL 등록 어떻게 했는지 공유
   - NO: 그대로 stub 로그인 상태로 운영 — 우리도 stub 유지하다 추후 연동

2. SSO 도입 계획이 있었다면 현재 진행 상황 / 담당자

---

## 4. 신규 환경 정보 (참고용)

| 항목 | 값 |
|---|---|
| 임시 도메인 (테스트 중) | `https://support2.oapms.com` |
| 운영 도메인 (cutover 예정) | `https://support.oapms.com` |
| 신규 DB | EC2 동일 노드 Docker pgvector/pgvector:pg16 (PG 16) |
| 신규 첨부 저장소 | AWS S3 `oaas-uploads-prd` (ap-northeast-2) |
| 알림 (Slack/SMS) | 받은 토큰으로 동일 채널·발신번호 사용 중 |
| Gitea repo | `http://192.168.0.66:9005/Dev/8_OA_AS` |
| CI/CD | Gitea push → Jenkins 자동 배포 + Slack 알림 |

---

## 5. 참고 — Neon에서 잔재 컬럼·테이블 DROP SQL (위 §2 케이스 B 선택 시)

```sql
ALTER TABLE hotels
  DROP COLUMN representative_name,
  DROP COLUMN corporate_name,
  DROP COLUMN hotel_type,
  DROP COLUMN contract_year,
  DROP COLUMN contract_month,
  DROP COLUMN slack_id,
  DROP COLUMN extra_contacts,
  DROP COLUMN extra_emails;

ALTER TABLE hotel_solution_links
  DROP COLUMN preset_id,
  DROP COLUMN login_id,
  DROP COLUMN password_enc;

DROP TABLE hotel_managed_links;
DROP TYPE hotel_type;
```

> ⚠️ 운영 트래픽이 아직 Neon으로 흐른다면 영향 검토 후 실행 부탁드립니다.

---

## 6. 회신 요청 사항 정리

다음 항목들 한 번에 회신해주시면 좋을 것 같습니다.

1. §2 (hotels) — A/B/C 중 어느 케이스인지 + 진행 방법
2. §3 (SSO) — 사용 여부 + (사용 시) 자격증명·콜백 URL
3. (선택) 그 외 우리가 모르고 있을 만한 운영 노하우·주의사항

---

문의 / 답변: 이관 담당자 (이쪽 채널로)
