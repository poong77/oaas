# 8_OA_AS CI/CD 파이프라인 — 최종본

> 자체 호스팅 EC2 + Docker PG + Jenkins + n8n + Gitea 환경.
> Vercel에서 이전한 후 첫 운영 배포까지 검증된 구성.
> 이 문서는 누군가 처음부터 다시 만들 때를 가정한 runbook이다.

---

## 0. 아키텍처

```
┌────────────────────────────────────────────────────────────────────────┐
│  사내망 (Tailscale + OpenVPN)                                          │
│                                                                        │
│   [개발자 PC] ──git push──> [Gitea 192.168.0.66:9005]                  │
│        │ OpenVPN                       │ webhook                       │
│        ▼                               ▼                               │
│   [VPC 10.250.0.0/16]            [Jenkins]                             │
│        │                               │                               │
│        ▼                               │ SSH (ec2-ssh-key)             │
│   [EC2 oaas-EC2-app-prd]<──────────────┘                               │
│   ip 10.250.20.12 (Private)                                            │
│   ├─ Nginx :80 (reverse proxy)                                         │
│   ├─ PM2: Next.js standalone :3000                                     │
│   └─ Docker: pgvector/pgvector:pg16 (127.0.0.1:5432→5432)              │
│        │                                                               │
│        └─ /var/lib/oaas-pgdata (영구 볼륨)                             │
│                                                                        │
│   [ALB oapms-ALB-prd]                                                  │
│   ├─ Listener HTTPS:443 (wildcard *.oapms.com ACM)                     │
│   └─ Rule(p10): Host=support2.oapms.com → TG oaas-target-prd-80        │
│                                                                        │
│   [S3 oaas-uploads-prd] ─── 첨부 (Server SDK PUT)                      │
│   [SSM /oaas/prd/*]     ─── 시크릿 + URL                               │
│                                                                        │
│   [n8n] ── cron 2개 ──> https://support2.oapms.com/api/cron/*          │
└────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  │ 외부 DNS (Cloudflare/등)
                                  │
                                  └─ support2.oapms.com (temp)
                                     CNAME → ALB DNS
                                     ※ cutover 시 support.oapms.com 추가
```

**핵심 결정 사항**
- DB: 같은 EC2 노드의 Docker 컨테이너 (RDS X). 운영 cutover 후에도 동일.
- pgvector: 공식 `pgvector/pgvector:pg16` 이미지 (호스트 직접 설치 PGDG 빌드는 AL2023 aarch64 ABI 충돌로 포기).
- 빌드: Next.js `output: 'standalone'` + PM2.
- 마이그레이션: `drizzle-kit push --force` (현재 `db/migrations/meta/` gitignore라 migrate 불가).

---

## 1. 산출물 (현재 repo에 들어있는 파일)

```
8_OA_AS/
├── Jenkinsfile                       # 6-stage 파이프라인
├── next.config.ts                    # output: 'standalone' + CSP 동적
├── package.json                      # pg + @aws-sdk/client-s3, vercel deps 제거
└── deploy/
    ├── setup-ec2.sh                  # EC2 부트스트랩 (1회)
    ├── nginx.conf                    # /etc/nginx/conf.d/oaas.conf 본체
    ├── ecosystem.dev.config.js       # PM2 DEV (미사용 현재)
    ├── ecosystem.prd.config.js       # PM2 PRD — max_memory_restart: 1500M
    ├── generate-env.sh               # SSM Parameter Store → .env (배포마다 실행)
    ├── healthcheck.sh                # ad-hoc /api/health probe
    ├── env/
    │   ├── .env.dev.example
    │   └── .env.prd.example
    └── n8n/
        ├── cron-cleanup-drafts.json        # 매일 03:00 KST
        └── cron-business-hours-overrides.json   # 매일 00:01 KST
```

---

## 2. AWS 리소스 인벤토리 (확정)

| 종류 | 이름/ID | 비고 |
|---|---|---|
| Security Group | `oaas-SG-ec2-prd` (`sg-09528dac9df997cf8`) | inbound: 22(Jenkins SG), 80(ALB SG), 5433(VPC CIDR — 운영 cutover 후 제거) |
| EC2 | `oaas-EC2-app-prd` (`i-0af3a484252dfdba3`) | t3.medium, AL2023 aarch64, 50GB gp3, Private IP 10.250.20.12 |
| S3 Bucket | `oaas-uploads-prd` | ap-northeast-2, 퍼블릭 차단, CORS에 `https://support2.oapms.com` 등록 |
| IAM Role | `oaas-IAM-role-ec2-prd` | EC2 인스턴스 프로필. SSM Read + S3 RW + KMS Decrypt |
| ALB Target Group | `oaas-target-prd-80` | HTTP:80, health check `/nginx-health` |
| ALB Listener Rule | priority 10 — `Host: support2.oapms.com` → TG | 기존 ALB `oapms-ALB-prd` 재활용 |
| SSL 인증서 | wildcard `*.oapms.com` (기존) | ACM, 변경 불필요 |
| SSM Parameter Store | `/oaas/prd/*` | DATABASE_URL, NEXTAUTH_SECRET, SLACK_*, SOLAPI_*, ANTHROPIC/OPENAI 등 ~20개 |
| External DNS | `support2.oapms.com` CNAME → ALB DNS | 외부 도메인 콘솔 (사내 도메인 담당자) |

**ALB DNS**: `oapms-ALB-prd-1644674482.ap-northeast-2.elb.amazonaws.com`

**EC2 Tailscale IP** (있으면 디버그용): `100.69.94.58`

---

## 3. Jenkins 셋업 (확정값)

### 3.1 Credentials
| ID | 종류 | 용도 |
|---|---|---|
| `ec2-ssh-key` | SSH Username with private key | EC2 배포 SSH (기존 재활용) |
| `oaas-gitea-pat` | Username with password (PAT) | Gitea Multibranch scan |
| `oaas-slack-bot-token` | Secret text | Slack 알림 (선택 — 없으면 try/catch로 skip) |

### 3.2 글로벌 환경변수 — **OAAS_ 프리픽스**

다른 프로젝트와 충돌 회피용. **Manage Jenkins → System → Global properties → Environment variables**:

| Name | Value |
|---|---|
| `OAAS_PRD_EC2_HOST` | `10.250.20.12` |
| `OAAS_PRD_PUBLIC_URL` | `https://support2.oapms.com` (cutover 시 변경) |
| `OAAS_SLACK_CHANNEL` | `#oaas-deploy` (선택) |

### 3.3 Multibranch Pipeline Job
- Job 이름: `8_OA_AS`
- Branch source: **Gitea** (`http://192.168.0.66:9005`)
- Owner: `Dev`, Repository: `8_OA_AS`
- Credentials: `oaas-gitea-pat`
- Branch filter: `^main$` 정규식
- Script Path: `Jenkinsfile`
- Periodic scan: 1 day (백업)
- **Controller executor**: ≥ 2 개 (이게 0이면 빌드 무한 대기)

### 3.4 Jenkins host 사전 조건
- Docker daemon 사용 가능 (Jenkins 실행 user가 docker group)
- Pipeline / Gitea / SSH Agent / Slack Notification 플러그인 설치
- `ssh` 명령 (OpenSSH) 사용 가능
- `node:20` 도커 이미지 pull 가능 (인터넷 또는 사내 registry)

---

## 4. 파이프라인 단계 (Jenkinsfile)

```
1. Environment    : 브랜치 → DEPLOY_ENV (main=prd), TARGET_HOST, PUBLIC_URL 결정
2. Build          : docker run node:20 → npm ci + next build (output:standalone)
                    → .next/standalone/server.js 존재 검증
3. PRD Approval   : main만, Slack 알림 + Jenkins input (60분 timeout)
4. Package        : tar.gz로
                    .next/standalone + .next/static + public + db/{migrations,schema}
                    + package.json + package-lock.json + drizzle.config.ts
5. Deploy         : scp + ssh로
                    - backup /app/oaas/standalone (최근 5개 유지)
                    - 추출
                    - migrator/ 격리 디렉토리에 drizzle-kit@0.30.1 + drizzle-orm@0.36.4 핀 install
                    - /app/oaas/node_modules 심볼릭 (drizzle.config.ts의 dotenv 해결용)
                    - scp deploy/generate-env.sh → SSM Parameter Store → /app/oaas/standalone/.env
                    - drizzle-kit push --force  (TTY 없는 CI에서 prompt 자동 회피)
                    - cp ecosystem.config.js
                    - pm2 reload (또는 첫 배포 시 start)
6. Health Check   : curl /api/health 5회 재시도
Post              : Slack 성공/실패 알림 (try/catch로 토큰 없어도 빌드 통과)
```

### 주요 결정 사항 / 함정
- `post { cleanup { sh ... } }`는 **사용 금지** — 빌드 일찍 실패하면 FilePath context 없어 MissingContextVariableException. 우리는 제거함.
- `drizzle-kit push`는 비-TTY에서 prompt 띄우고 자동 "No, abort" → 반드시 `--force`.
- `pm2 max_memory_restart` 값은 정수 + K/M/G만 허용. `1.5G` 안 됨 → `1500M`.
- Build stage가 standalone 산출물 없으면 abort (test -f `.next/standalone/server.js`).

---

## 5. EC2 부트스트랩 (`deploy/setup-ec2.sh`, 1회 실행)

```
sudo bash deploy/setup-ec2.sh   # DB_PASS는 환경변수로 별도 주입
```

내부 작업 (재실행 멱등):
1. dnf update
2. **Node 20 (NodeSource RPM)** — AL2023의 nodejs20 패키지는 실제로 Node 18을 깔아주는 문제 회피
3. PM2 + systemd startup
4. Nginx (`/etc/nginx/conf.d/oaas.conf` 복사 + 재시작, 인라인 server 블록 제거 필요)
5. AWS CLI 확인
6. ~~PostgreSQL 16 + pgvector (PGDG)~~ → **현재는 Docker로 대체**
7. `/app/oaas/{standalone,backups,logs,db}` 디렉토리
8. `/app/oaas/.env` 심볼릭 (`→ standalone/.env`, drizzle-kit이 cwd에서 dotenv 자동 로드)

### 5.1 Docker PG 실행 (setup-ec2.sh 외부에서 수동 1회)

```bash
sudo dnf install -y docker
sudo systemctl enable --now docker

sudo docker run -d \
  --name oaas-pg \
  --restart unless-stopped \
  -e POSTGRES_USER=oaas \
  -e POSTGRES_PASSWORD='<STRONG_PW>' \
  -e POSTGRES_DB=oaas_prd \
  -v /var/lib/oaas-pgdata:/var/lib/postgresql/data \
  -p 127.0.0.1:5432:5432 \
  pgvector/pgvector:pg16

sudo docker exec -i oaas-pg psql -U oaas -d oaas_prd -c "CREATE EXTENSION vector;"
```

> 운영 cutover 후엔 `127.0.0.1:5432:5432`로 잠금. 테스트 동안만 `0.0.0.0:5433:5432`로 외부 접근 허용 가능.

### 5.2 Nginx 인라인 server 블록 제거

AL2023의 `/etc/nginx/nginx.conf`에 인라인 `server {}` 블록이 default_server로 잡혀 `conf.d/oaas.conf`보다 먼저 매칭되는 사고. Python 한 줄로 안전 제거:

```bash
sudo python3 - <<'PYEOF'
with open('/etc/nginx/nginx.conf') as f: content = f.read()
i = content.find('server {')
if i >= 0:
    depth = 0; j = i
    while j < len(content):
        if content[j] == '{': depth += 1
        elif content[j] == '}':
            depth -= 1
            if depth == 0: j += 1; break
        j += 1
    with open('/etc/nginx/nginx.conf', 'w') as f: f.write(content[:i] + content[j:])
PYEOF
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. SSM Parameter Store

전체 키 목록 (`/oaas/prd/*`):

**시크릿 (SecureString)**
- `DATABASE_URL` — `postgres://oaas:...@127.0.0.1:5432/oaas_prd?sslmode=disable`
- `NEXTAUTH_SECRET`
- `CRON_SECRET`
- `OA_SSO_CLIENT_ID`, `OA_SSO_CLIENT_SECRET` (확보 시)
- `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`
- `SLACK_BOT_TOKEN`
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`

**일반 (String)**
- `NEXTAUTH_URL`, `PUBLIC_BASE_URL` — `https://support2.oapms.com` (cutover 후 `support`)
- `OA_SSO_ISSUER`, `SOLAPI_SENDER`
- `SLACK_CHANNEL_NEW`, `SLACK_CHANNEL_URGENT`, `SLACK_CHANNEL_DEV`
- `S3_UPLOAD_BUCKET` (`oaas-uploads-prd`), `S3_UPLOAD_PUBLIC_URL`
- `SES_FROM_EMAIL`

**generate-env.sh의 STATIC 블록** (SSM 안 거치고 코드에 박힘): `NODE_ENV`, `PORT`, `HOSTNAME`, `AWS_REGION`, `OPENAI_EMBEDDING_MODEL`.

### 등록은 로컬 PC에서

EC2의 IAM Role은 GetParameter만 — PutParameter는 본인 AWS CLI 자격증명으로:

```bash
aws ssm put-parameter --region ap-northeast-2 --type SecureString --overwrite \
  --name /oaas/prd/<KEY> --value '<VALUE>'
```

SSM 값 바꾼 뒤엔 Jenkins **Build Now** → Deploy stage가 자동으로 `generate-env.sh` 다시 호출 → PM2 reload.

---

## 7. n8n Cron

- HTTP Request 노드 + Header Auth credential `OAAS Cron Bearer`
- Authorization: `Bearer <CRON_SECRET 값>`
- URL: `https://support2.oapms.com/api/cron/{cleanup-drafts,business-hours-overrides}`
- Cron expr: `0 3 * * *` (cleanup) / `1 0 * * *` (business-hours), timezone Asia/Seoul

cutover 시 URL의 `support2` → `support`만 갱신.

---

## 8. 첫 배포 체크리스트 (재현 가능)

```
[A] 인프라
  [✓] SG 생성 + 22/80 inbound
  [✓] EC2 launch + IAM Role attach
  [✓] S3 버킷 + CORS
  [✓] SSM Parameter Store 등록 (DATABASE_URL은 PG 비번 정해진 직후)
  [✓] ALB Target Group + host-based Listener Rule
  [✓] 외부 DNS CNAME (support2.oapms.com → ALB)

[B] EC2 부트스트랩
  [✓] setup-ec2.sh 실행
  [✓] Docker PG 컨테이너 + CREATE EXTENSION vector
  [✓] Nginx 인라인 server 제거 + reload
  [✓] /tmp/oaas-nginx.conf 복사 (deploy/nginx.conf 내용)

[C] Jenkins
  [✓] Credentials 3개
  [✓] Global env vars (OAAS_*)
  [✓] Multibranch Job + Gitea source + branch filter
  [✓] Controller executor ≥ 2

[D] Gitea
  [✓] Webhook 자동 등록 (Manage hooks 옵션)

[E] n8n
  [✓] Header Auth credential
  [✓] 워크플로우 2개 import + Activate

[F] 첫 빌드
  [✓] main push → 자동 빌드
  [✓] /api/health 200
  [✓] curl ALB DNS + Host header 200
  [✓] external DNS 통한 https://support2.oapms.com/api/health 200
```

---

## 9. 알려진 함정 + 해결법 (실제 발생한 케이스)

| 증상 | 원인 | 해결 |
|---|---|---|
| 빌드가 영원히 큐에 박힘 | Controller executor = 0 | Manage Jenkins → Built-in Node → executors 2+ |
| `Cannot find module '@/lib/...'` 빌드 실패 | drizzle-kit이 TS alias 해석 불가 | 의존 코드를 schema 파일 안으로 옮겨 self-contained |
| schema 0개 적용 + 배포 성공 보고 | drizzle-kit push가 비-TTY에서 "No, abort" 선택 | `--force` 플래그 |
| `Can't find meta/_journal.json` | `db/migrations/meta/` gitignore | push 사용 (migrate 포기) |
| 마이그레이션이 silent fail | drizzle-kit/orm 버전 불일치 (0.31 vs 0.36) | migrator install 버전 핀 |
| `Bad permissions` SSH 키 | Windows ACL이 너무 열림 | `icacls /inheritance:r /grant:r "$($env:USERNAME):R"` |
| PG 16 dump 오류 (server 17.x) | pg_dump 버전이 server보다 낮음 | `docker run --rm postgres:17 pg_dump ...` |
| `transaction_timeout` 미인식 | Neon PG 17 → Docker PG 16 import | 무해, 무시 |
| PM2가 silent로 안 시작 | `max_memory_restart: '1.5G'` 검증 실패 | `1500M`으로 |
| Nginx 404 default page | `/etc/nginx/nginx.conf`의 인라인 server가 default_server | Python 한 줄 sed로 제거 |
| ALB→EC2 health check 안 됨 | TG가 Nginx down 상태에 health check | `/nginx-health` 응답 확인 |
| `MissingContextVariableException` in post cleanup | post cleanup의 `sh`가 FilePath 컨텍스트 없음 | post cleanup 블록 제거 |
| Groovy `unexpected char: '\'` | Jenkinsfile 주석에 \` 이스케이프 시도 | 단순 문자열로 변경 |
| `node:20` 도커 풀이 첫 빌드만 오래 걸림 | 정상 | 이후 빌드는 캐시 |
| 다른 프로젝트의 PRD_EC2_HOST 침범 | 글로벌 env var 충돌 | `OAAS_` 프리픽스 |
| .env에 placeholder가 들어옴 | SSM 등록 시 `--value 'PASTE_...여기에'` 그대로 박힘 | 실제 값으로 overwrite |
| PG 직접 접속 timeout | EC2 SG에 5433 inbound 없음 | SG에 룰 추가 + Docker `-p 5433:5432` |

---

## 10. 운영 작업 (런북)

### 배포
- main에 commit + push → Gitea webhook → Jenkins 자동 빌드
- 또는 Jenkins 콘솔에서 **Build Now**

### 환경 변수 변경
1. 로컬에서 `aws ssm put-parameter --overwrite ...`
2. Jenkins Build Now → Deploy stage가 자동으로 generate-env.sh 재실행 → PM2 reload

### 롤백
EC2의 `/app/oaas/backups/` 에 최근 5개 standalone 백업 보존:
```bash
cd /app/oaas
ls -t backups/                   # 최신순
rm -rf standalone
cp -r backups/<YYYYMMDD_HHMMSS>/standalone .
pm2 reload ecosystem.config.js --update-env
```

### DB 백업
```bash
sudo docker exec oaas-pg pg_dump -U oaas oaas_prd > /backup/oaas_prd_$(date +%F).sql
```

### Neon → 신규 DB 데이터 이관 (참고)
```bash
# 1. Neon 데이터만 dump (PG 17 사용, 우리 PG는 16 — 호환)
sudo docker run --rm -e NEON_URL="$NEON_URL" postgres:17 \
  pg_dump --data-only --no-owner --no-privileges --disable-triggers \
  --quote-all-identifiers "$NEON_URL" > /tmp/neon-data.sql

# 2. import
cat /tmp/neon-data.sql | sudo docker exec -i oaas-pg psql -U oaas -d oaas_prd
```

스키마 차이 발생 시 (Neon에 추가 컬럼 등) `psql -At -c "COPY (SELECT ... FROM table) TO STDOUT"`로 컬럼 골라 추출.

---

## 11. support2 → support.oapms.com Cutover 절차 (최종)

테스트 통과 후 도메인 전환:

```
[a] Jenkins env: OAAS_PRD_PUBLIC_URL → https://support.oapms.com
[b] SSM 갱신:
    /oaas/prd/NEXTAUTH_URL    → https://support.oapms.com
    /oaas/prd/PUBLIC_BASE_URL → https://support.oapms.com
[c] ALB Listener Rule 추가 (또는 기존 룰의 host 변경):
    priority 9: Host = support.oapms.com → oaas-target-prd-80
[d] S3 CORS에 https://support.oapms.com 추가
[e] n8n cron 2개의 HTTP Request URL을 support로
[f] Jenkins Build Now → /api/health support 도메인으로 검증
[g] 외부 DNS: support.oapms.com CNAME → ALB DNS 추가
    (기존 Apache 서버 트래픽이 ALB로 전환됨)
[h] 안정 확인 후 support2 룰/DNS 제거
[i] (보안 강화) Docker PG 바인딩 127.0.0.1:5432:5432로 되돌리기
    EC2 SG에서 5433 inbound 룰 제거
[j] 채팅 노출된 시크릿 일괄 회전 (Slack/Solapi/Anthropic/OpenAI/DB pw)
```

---

## 12. 빠른 시작 (한 줄 요약)

```
인프라 생성 (콘솔) → setup-ec2.sh + Docker PG → SSM 등록 → Jenkins Job + env
→ main push → 자동 빌드/배포 → /api/health 200 → DNS 전환.
```

Repo 상태가 곧 진실. Jenkinsfile + deploy/ 가 변경되면 이 문서도 같이 갱신.
