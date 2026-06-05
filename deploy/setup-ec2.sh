#!/bin/bash
# ============================================================
# 8_OA_AS (통합AS) EC2 초기 세팅 스크립트
# OS: Amazon Linux 2023
# 용도: DEV/PRD 서버 첫 구성 시 1회 실행
#
# 사용법:
#   chmod +x setup-ec2.sh
#   sudo ./setup-ec2.sh
#
# 설치 항목:
#   - Node.js 20 LTS
#   - PM2 (프로세스 매니저)
#   - Nginx (리버스 프록시)
#   - PostgreSQL 16 + pgvector 확장 (EC2 동일 노드, 소규모 운영용)
#   - AWS CLI (Parameter Store 접근)
#   - /app/oaas/ 디렉토리 구조
# ============================================================

set -e

echo "=========================================="
echo "  8_OA_AS EC2 Setup Script"
echo "  OS: Amazon Linux 2023"
echo "=========================================="

# ----------------------------------------
# 1. 시스템 업데이트
# ----------------------------------------
echo ">>> [1/9] System Update..."
dnf update -y

# ----------------------------------------
# 2. Node.js 20 LTS 설치 (NodeSource — AL2023 기본 repo에 nodejs20 패키지 없음)
# ----------------------------------------
echo ">>> [2/9] Installing Node.js 20 (NodeSource)..."

# 이전에 잘못 깔린 Node 18 잔여물 제거 (멱등)
dnf remove -y nodejs nodejs18 nodejs20 npm 2>/dev/null || true

# NodeSource repo 추가 → Node 20 LTS 설치 (npm 번들로 포함)
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs

node -v   # v20.x.x
npm -v

# ----------------------------------------
# 3. PM2 설치
# ----------------------------------------
echo ">>> [3/9] Installing PM2..."
npm install -g pm2

# 서버 재부팅 시 PM2 자동 시작
pm2 startup systemd -u ec2-user --hp /home/ec2-user
env PATH=$PATH:/usr/bin pm2 startup systemd -u ec2-user --hp /home/ec2-user

# ----------------------------------------
# 4. Nginx 설치
# ----------------------------------------
echo ">>> [4/9] Installing Nginx..."
dnf install -y nginx
systemctl enable nginx

# ----------------------------------------
# 5. AWS CLI 확인
# ----------------------------------------
echo ">>> [5/9] Checking AWS CLI..."
aws --version || {
    echo "AWS CLI not found, installing..."
    dnf install -y aws-cli
}

# ----------------------------------------
# 6. PostgreSQL 16 + pgvector 설치 (PGDG repo, EC2 동일 노드)
#
# AL2023 내장 postgresql15에는 -devel 패키지가 없어 (특히 aarch64) pgvector 소스 빌드가
# 안 된다. PGDG EL9 repo는 RPM(postgresql16-devel + pgvector_16)을 제공해 가장 안정적.
# 소규모 운영 / 단일 노드 자체 호스팅 정책 (사용자 결정).
# RDS PostgreSQL로 이전 시 이 단계 스킵 가능 — DATABASE_URL만 RDS 엔드포인트로 교체.
# ----------------------------------------
echo ">>> [6/9] Installing PostgreSQL 16 + pgvector (PGDG)..."

# AL2023 stock postgresql 잔여물 제거 (충돌 방지 — 멱등)
systemctl stop postgresql 2>/dev/null || true
dnf remove -y postgresql15-server postgresql15 postgresql15-contrib 2>/dev/null || true

# PGDG의 메타 RPM(pgdg-redhat-repo-latest)은 /etc/redhat-release 패키지를 RPM 레벨에서
# 요구하는데 AL2023엔 그걸 제공하는 패키지가 없어 어떤 shim으로도 우회 불가.
# .repo 파일을 직접 작성해 PGDG 16 + common 두 repo를 등록한다.
cat > /etc/yum.repos.d/pgdg-redhat-all.repo <<'EOF'
[pgdg16]
name=PostgreSQL 16 for RHEL 9 - $basearch
baseurl=https://download.postgresql.org/pub/repos/yum/16/redhat/rhel-9-$basearch
enabled=1
gpgcheck=0

[pgdg-common]
name=PostgreSQL common RPMs for RHEL 9 - $basearch
baseurl=https://download.postgresql.org/pub/repos/yum/common/redhat/rhel-9-$basearch
enabled=1
gpgcheck=0
EOF

dnf clean expire-cache
dnf makecache

# AL2023 빌트인 postgresql 모듈 비활성 (PGDG 우선)
dnf -qy module disable postgresql

# PG 16 + devel + pgvector_16 RPM (소스 빌드 불필요)
dnf install -y postgresql16-server postgresql16 postgresql16-contrib postgresql16-devel pgvector_16

PG_VERSION=16
PG_DATA=/var/lib/pgsql/16/data
PG_BIN=/usr/pgsql-16/bin
PG_SETUP=$PG_BIN/postgresql-16-setup
PG_SERVICE=postgresql-16

# initdb (이미 되어 있으면 skip)
if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    $PG_SETUP initdb
fi

# localhost-only 인증 (사내망 단일 노드 가정). 외부 노출 시 pg_hba.conf 추가 잠금 필요.
PG_HBA=$PG_DATA/pg_hba.conf
if ! grep -q "# 8_OA_AS local app" $PG_HBA 2>/dev/null; then
    cat >> $PG_HBA <<EOF

# 8_OA_AS local app (Next.js standalone)
host    all             oaas           127.0.0.1/32            scram-sha-256
EOF
fi

systemctl enable $PG_SERVICE
systemctl start $PG_SERVICE

echo ">>> [6.1] Verifying pgvector RPM..."
# pgvector_16 RPM은 이미 설치됐어야 함. extension은 DB 단위로 활성.
sudo -u postgres psql -c "SELECT name, default_version FROM pg_available_extensions WHERE name='vector';"

# DB / 사용자 / 확장 생성 (멱등 처리 — 이미 있어도 안전)
DB_NAME=${DB_NAME:-oaas_prd}    # DEV 셋업 시 DB_NAME=oaas_dev로 export 후 실행
DB_USER=${DB_USER:-oaas}
DB_PASS=${DB_PASS:-changeme}     # 운영에서는 반드시 export DB_PASS=...로 덮어쓰기

# 각 단계 멱등: 이미 있어도 에러 없이 통과.
# `|| true`로 전체 마스킹하지 않음 — 에러는 그대로 보이게 (조용한 실패 방지).
echo ">>> Creating DB user '${DB_USER}' (skip if exists)..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

echo ">>> Creating DB '${DB_NAME}' (skip if exists)..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

echo ">>> Enabling pgvector + granting on ${DB_NAME}..."
sudo -u postgres psql -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS vector;"
sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};"

systemctl restart $PG_SERVICE

# ----------------------------------------
# 7. 앱 디렉토리 생성
# ----------------------------------------
echo ">>> [7/9] Creating app directories..."
mkdir -p /app/oaas/standalone
mkdir -p /app/oaas/backups
mkdir -p /app/oaas/logs
mkdir -p /app/oaas/db/migrations
mkdir -p /app/oaas/db/schema

chown -R ec2-user:ec2-user /app

# ----------------------------------------
# 8. Nginx 설정 적용
# ----------------------------------------
echo ">>> [8/9] Configuring Nginx..."

cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup 2>/dev/null || true

# deploy/nginx.conf를 미리 /tmp에 업로드해두어야 함
if [ -f /tmp/oaas-nginx.conf ]; then
    cp /tmp/oaas-nginx.conf /etc/nginx/conf.d/oaas.conf
    nginx -t && systemctl restart nginx
    echo "Nginx configured successfully!"
else
    echo "⚠️  Nginx config not found at /tmp/oaas-nginx.conf"
    echo "    배포 머신에서:"
    echo "    scp deploy/nginx.conf ec2-user@\$EC2_HOST:/tmp/oaas-nginx.conf"
    echo "    EC2에서:"
    echo "    sudo cp /tmp/oaas-nginx.conf /etc/nginx/conf.d/oaas.conf"
    echo "    sudo nginx -t && sudo systemctl restart nginx"
fi

# ----------------------------------------
# 9. .env 심볼릭 (drizzle-kit cwd에서 dotenv 자동 로드용)
# ----------------------------------------
echo ">>> [9a] Creating .env symlink for drizzle-kit..."
if [ ! -L /app/oaas/.env ]; then
    ln -sfn /app/oaas/standalone/.env /app/oaas/.env
    chown -h ec2-user:ec2-user /app/oaas/.env
fi

# ----------------------------------------
# 10. 결과 요약
# ----------------------------------------
echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo "  Node.js    : $(node -v)"
echo "  npm        : $(npm -v)"
echo "  PM2        : $(pm2 -v)"
echo "  Nginx      : $(nginx -v 2>&1)"
echo "  PostgreSQL : $($PG_BIN/psql --version 2>&1)"
echo "  pgvector   : $(sudo -u postgres psql -tAc "SELECT extversion FROM pg_extension WHERE extname='vector'" 2>/dev/null || echo 'not installed')"
echo "  AWS CLI    : $(aws --version 2>&1 | head -1)"
echo ""
echo "  App Dir    : /app/oaas/"
echo "  DB         : ${DB_NAME} (owner: ${DB_USER})"
echo "=========================================="
echo ""
echo "다음 단계:"
echo "  1. /app/oaas/standalone/.env 파일 생성 (deploy/env/.env.*.example 참조)"
echo "     DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
echo "  2. Nginx 설정 적용 (위 안내 참조)"
echo "  3. Jenkins 파이프라인에서 첫 배포 실행"
echo ""
