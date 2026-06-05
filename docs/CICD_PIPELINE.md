# 8_OA_AS CI/CD 파이프라인 (Gitea + Jenkins + n8n)

> 참고 원본: `J:\oaWork\9_OA_ONE\docs\CICD_PORTING_GUIDE.md` (OA-ONE Vite+NestJS 분리형 → Next.js 단일 모노앱으로 변형 적용)

## 0. 한눈에 보는 아키텍처

```
Gitea push → Webhook → Jenkins (6 stages) → SSH → EC2
                          │
              ┌───────────┴───────────┐
          develop                    main
          (자동)                  (수동승인)
              │                       │
              ▼                       ▼
     ┌─────────────────┐    ┌─────────────────┐
     │ EC2 t3.small    │    │ EC2 t3.medium   │
     │  Next.js        │    │  Next.js        │
     │  standalone     │    │  standalone     │
     │  + PM2 + Nginx  │    │  + PM2 + Nginx  │
     │  + PG16+pgvec   │    │  + PG16+pgvec   │
     └────────┬────────┘    └────────┬────────┘
              │                       │
              └─────────┬─────────────┘
                        ▼
                 S3 + CloudFront (첨부 파일)
                        │
                        ▼
                  n8n (cron 2개)
```

**변경점 (OA-ONE 대비)**
- Frontend S3+CloudFront 분리 배포 단계 **삭제** (Next.js 단일 앱)
- DB 마이그레이션 단계 **추가** (drizzle-kit migrate, Deploy stage 내)
- RDS MySQL → **EC2 동일 노드 PostgreSQL 16 + pgvector** (사용자 결정)
- Vercel Cron → **n8n cron** 2개

---

## 1. 산출물 (이 PR에 포함)

```
8_OA_AS/
├── Jenkinsfile                       # 6-stage 파이프라인
├── next.config.ts                    # output: 'standalone'
├── vercel.json                       # 삭제됨
└── deploy/
    ├── setup-ec2.sh                  # EC2 초기 세팅 (PG16+pgvector 포함)
    ├── nginx.conf                    # 리버스 프록시 + static cache
    ├── ecosystem.dev.config.js       # PM2 DEV
    ├── ecosystem.prd.config.js       # PM2 PRD
    ├── generate-env.sh               # SSM Parameter Store → .env
    ├── healthcheck.sh                # /api/health 5회 재시도
    ├── env/
    │   ├── .env.dev.example
    │   └── .env.prd.example
    └── n8n/
        ├── cron-cleanup-drafts.json
        └── cron-business-hours-overrides.json
```

---

## 2. Search & Replace 체크리스트

새 환경/도메인에 맞춰 아래를 일괄 치환.

| 원본 | 변경 예시 | 위치 |
|---|---|---|
| `oaas` | `oaas` (그대로) 또는 `as` | Jenkinsfile, deploy/*.{sh,conf,js} |
| `/app/oaas` | (그대로) | Jenkinsfile, ecosystem, nginx, setup-ec2, generate-env |
| `oaas-uploads-dev/prd` | 실제 S3 버킷명 | .env, n8n |
| `oaas-slack-bot-token` | Jenkins Credential ID | Jenkinsfile |
| `#oaas-deploy` | 실제 Slack 채널 | Jenkinsfile, Jenkins env |
| `as-dev.oapms.co`, `support.oapms.com` | 실제 도메인 | .env, Jenkins env, nginx (server_name) |
| `/oaas/prd/` | SSM Parameter Store 경로 | generate-env.sh |
| `oaas`, `oaas_dev`, `oaas_prd` | DB 사용자/DB명 | setup-ec2.sh, .env |

---

## 3. AWS 리소스 (수동 생성, 콘솔)

> **⚠️ 절대규칙**: AWS 리소스는 사용자 명시적 허락 없이 자동 생성 금지.

```
[ ] Security Group (sg-oaas-ec2)
    - SSH:22 (Jenkins SG/관리자 IP)
    - HTTP:80 (ALB SG 또는 0.0.0.0/0)
    - PG:5432 (EC2 내부에서만 — 외부 노출 금지, 동일 노드면 불필요)

[ ] EC2 × 2 (Amazon Linux 2023)
    - DEV: t3.small, 30GB gp3 (PG 동일 노드 운영용 여유)
    - PRD: t3.medium, 50GB gp3
    - IAM Role: SSM Parameter Store 읽기 + S3 Put 권한 (PRD)

[ ] S3 버킷 × 2 (첨부 파일 저장)
    - oaas-uploads-dev
    - oaas-uploads-prd
    - 퍼블릭 차단 + CloudFront OAC만 허용 (직접 공개 시 ACL public-read)

[ ] CloudFront × 2 (선택, 첨부 CDN 캐싱)
    - Origin: S3 (OAC)
    - 대체 도메인: files-dev.support.oapms.com / files.support.oapms.com
    - SSL: ACM 인증서

[ ] Route 53
    - support.oapms.com (PRD A → ALB or EC2)
    - as-dev.oapms.co (DEV)
    - files.support.oapms.com (CloudFront 첨부)

[ ] IAM User (jenkins-oaas-deployer) — 선택 (EC2 IAM Role로 충분 시 생략)
    - S3 Put/Delete (위 2개 버킷)
    - CloudFront CreateInvalidation (위 2개 Distribution)

[ ] SSM Parameter Store (PRD만, /oaas/prd/* SecureString)
    - DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
    - OA_SSO_CLIENT_ID/SECRET/ISSUER
    - SOLAPI_API_KEY/SECRET/SENDER
    - AWS_ACCESS_KEY_ID/SECRET (IAM User 사용 시)
    - SES_FROM_EMAIL, S3_UPLOAD_BUCKET, S3_UPLOAD_PUBLIC_URL
    - SLACK_BOT_TOKEN, SLACK_CHANNEL_NEW/URGENT/DEV
    - PUBLIC_BASE_URL, OACHAT_EMBED_URL
    - ANTHROPIC_API_KEY, OPENAI_API_KEY
    - CRON_SECRET
```

---

## 4. Jenkins 설정

### 4.1 Credentials (Manage Credentials → System → Global)

```
ec2-ssh-key             SSH Username with private key (user: ec2-user)
oaas-slack-bot-token   Secret text (Slack Bot Token xoxb-..., 선택)
```

### 4.2 환경변수 (Job > Configure 또는 전역)

```bash
DEV_EC2_HOST     = 10.0.x.x
PRD_EC2_HOST     = 10.0.x.x
DEV_PUBLIC_URL   = https://as-dev.oapms.co
PRD_PUBLIC_URL   = https://support.oapms.com
SLACK_CHANNEL    = #oaas-deploy
```

### 4.3 Job 생성 (Multibranch Pipeline 권장)

```
New Item → "8_OA_AS" → Multibranch Pipeline
- Branch Source: Gitea (repo URL + credentials)
- Build Configuration: by Jenkinsfile (Script Path: Jenkinsfile)
- Branch Filtering: Include "develop main"
```

---

## 5. EC2 초기 세팅 (DEV/PRD 각각 1회)

```bash
# 1. 로컬 → EC2 업로드
scp deploy/setup-ec2.sh ec2-user@EC2_IP:/tmp/
scp deploy/nginx.conf   ec2-user@EC2_IP:/tmp/oaas-nginx.conf

# 2. EC2에서 실행
ssh ec2-user@EC2_IP
chmod +x /tmp/setup-ec2.sh
# DB 자격증명 지정 (필수 — 기본값 'changeme' 사용 금지)
sudo DB_NAME=oaas_prd DB_USER=oaas DB_PASS='STRONG_PW' /tmp/setup-ec2.sh
# → Node 20, PM2, Nginx, PostgreSQL 16+pgvector, /app/oaas 자동 구성

# 3. .env 생성
# DEV: 수동 생성
cp deploy/env/.env.dev.example /app/oaas/standalone/.env
vi /app/oaas/standalone/.env

# PRD: SSM Parameter Store에서 자동 생성
cd /app/oaas
./deploy/generate-env.sh prd /app/oaas/standalone/.env
```

---

## 6. Gitea Webhook

```
Gitea > Repo (8_OA_AS) > Settings > Webhooks > Add Webhook > Gitea
- Target URL:
  Multibranch: https://JENKINS_URL/gitea-webhook/post?job=8_OA_AS
- Content Type: application/json
- Trigger On: Push Events
- Branch filter: develop main
```

CSRF 403 발생 시: Jenkins > Configure Global Security > CSRF Protection > "Enable proxy compatibility" 체크.

---

## 7. n8n Cron 셋업

1. n8n에서 Credentials → Header Auth 생성:
   - Name: `OA-AS Cron Bearer`
   - Header Name: `Authorization`
   - Header Value: `Bearer <CRON_SECRET 값>`

2. Workflows → Import from File → `deploy/n8n/cron-cleanup-drafts.json` 가져오기
3. 동일하게 `deploy/n8n/cron-business-hours-overrides.json` 가져오기
4. 각 워크플로우에서:
   - HTTP Request 노드의 URL을 DEV/PRD 도메인으로 확정
   - Credentials 슬롯에 위에서 만든 `OA-AS Cron Bearer` 연결
   - Activate 토글 ON

스케줄(KST 기준):
- `cron-cleanup-drafts` — 매일 03:00
- `cron-business-hours-overrides` — 매일 00:01

---

## 8. 첫 배포 체크리스트

```
인프라:
  [ ] EC2 × 2 생성 + setup-ec2.sh 실행 완료
  [ ] DEV .env 수동 작성, PRD SSM Parameter Store 등록 완료
  [ ] S3 버킷 × 2 + (선택) CloudFront × 2
  [ ] 도메인 Route 53 연결

Jenkins:
  [ ] Credentials 2개 (ec2-ssh-key + slack token)
  [ ] 환경변수 5개 (DEV/PRD HOST/URL + SLACK_CHANNEL)
  [ ] Multibranch Pipeline Job 생성

Gitea:
  [ ] Webhook 등록 + Test Delivery 성공

n8n:
  [ ] Header Auth credential `OA-AS Cron Bearer` 생성
  [ ] 워크플로우 2개 import + Activate

브랜치 전략:
  [ ] develop 브랜치 신설 (현재는 main만 존재)

첫 배포:
  [ ] develop push → Jenkins DEV 자동 배포 통과
  [ ] /api/health 200 확인
  [ ] 어드민 로그인 + 한 사이클 동작 확인
  [ ] main 머지 → PRD 승인 → PRD 배포
```

---

## 9. 자주 발생하는 이슈

### 9.1 standalone server.js 미생성
**원인**: `next.config.ts`에 `output: 'standalone'` 누락.
**확인**: `ls .next/standalone/server.js` 후 재빌드.

### 9.2 drizzle-kit migrate 실패
**원인**: Deploy stage에서 `.env` 미로드.
**해결**: `/app/oaas/standalone/.env`에 DATABASE_URL이 있는지 확인. Deploy 스크립트가 `grep -v '^#' .env | xargs`로 env 주입.

### 9.3 pgvector 확장 없음
**증상**: 시드 시 `type "vector" does not exist` 에러.
**해결**: EC2에서 `sudo -u postgres psql -d oaas_prd -c 'CREATE EXTENSION IF NOT EXISTS vector;'`

### 9.4 첨부 업로드 503 (S3_UPLOAD_BUCKET 미설정)
**증상**: `/api/upload`에서 503 + "S3 업로드 버킷이 설정되지 않았습니다".
**해결**: `.env`의 `S3_UPLOAD_BUCKET` 채움 + PM2 reload.

### 9.5 n8n cron 401 Unauthorized
**원인**: Header Auth credential 미연결 또는 CRON_SECRET 불일치.
**해결**: n8n credential value(`Bearer <secret>`)와 EC2 `.env`의 `CRON_SECRET`이 동일한지 확인.

### 9.6 PM2 재시작 후 환경변수 미반영
**해결**: `pm2 reload ecosystem.config.js --update-env` (단순 restart는 env 갱신 안 됨).

### 9.7 PRD 승인 timeout
Jenkinsfile에 60분 timeout. 60분 안 누르면 Slack에 "PRD 배포 취소" 알림 + 빌드 실패.

---

## 10. 빠른 시작 (TL;DR)

```bash
# 1. 인프라 (AWS 콘솔에서 수동)
#    EC2 × 2, S3 × 2, (선택) CloudFront × 2, SSM Parameter Store

# 2. EC2 셋업 (DEV, PRD 각각)
scp deploy/setup-ec2.sh deploy/nginx.conf ec2-user@EC2:/tmp/
ssh ec2-user@EC2 'sudo DB_PASS=STRONG_PW /tmp/setup-ec2.sh'

# 3. Jenkins 셋업 (§4)

# 4. Gitea Webhook (§6)

# 5. n8n cron import (§7)

# 6. develop 브랜치 신설 + push → 자동 DEV 배포
git checkout -b develop && git push -u origin develop
```
