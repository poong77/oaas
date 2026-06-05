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
# 6. PostgreSQL 16 + pgvector 설치 (EC2 동일 노드)
#
# 소규모 운영 / 단일 노드 자체 호스팅 정책 (사용자 결정).
# RDS PostgreSQL로 이전 시 이 단계 스킵 가능 — DATABASE_URL만 RDS 엔드포인트로 교체.
# ----------------------------------------
echo ">>> [6/9] Installing PostgreSQL 16 + pgvector..."

# Amazon Linux 2023의 기본 PG는 15. PG 16은 PGDG repo에서 받는다.
# (PGDG가 AL2023를 지원하지 않으면 dnf 기본 postgresql15-server로 폴백.)
if dnf install -y postgresql16-server postgresql16 postgresql16-contrib postgresql16-devel 2>/dev/null; then
    PG_VERSION=16
    PG_DATA=/var/lib/pgsql/16/data
    PG_BIN=/usr/pgsql-16/bin
    PG_SETUP=$PG_BIN/postgresql-16-setup
    PG_SERVICE=postgresql-16
else
    echo "⚠️  PostgreSQL 16 패키지 없음 — AL2023 내장 postgresql15-server로 폴백"
    dnf install -y postgresql15-server postgresql15 postgresql15-contrib
    PG_VERSION=15
    PG_DATA=/var/lib/pgsql/data
    PG_BIN=/usr/bin
    PG_SETUP=/usr/bin/postgresql-setup
    PG_SERVICE=postgresql
fi

# initdb (이미 되어 있으면 skip)
if [ ! -f "$PG_DATA/PG_VERSION" ]; then
    $PG_SETUP --initdb
fi

# localhost-only 트러스트 (사내망 단일 노드 가정). 외부 노출 시 pg_hba.conf 추가 잠금 필요.
PG_HBA=$PG_DATA/pg_hba.conf
if ! grep -q "# 8_OA_AS local app" $PG_HBA 2>/dev/null; then
    cat >> $PG_HBA <<EOF

# 8_OA_AS local app (Next.js standalone)
host    all             oaas           127.0.0.1/32            scram-sha-256
EOF
fi

systemctl enable $PG_SERVICE
systemctl start $PG_SERVICE

# pgvector 빌드/설치 (PGDG에 패키지가 없는 케이스 대비 소스 빌드).
# pgvector는 pgxs로 빌드되며 postgresql-devel만 있으면 충분.
echo ">>> [6.1] Installing pgvector extension..."
if ! sudo -u postgres psql -c "SELECT extname FROM pg_extension WHERE extname='vector'" | grep -q vector; then
    if ! dnf install -y pgvector_$PG_VERSION 2>/dev/null; then
        echo "  pgvector RPM 없음 — 소스 빌드"
        dnf install -y git gcc make
        TMP_PGV=$(mktemp -d)
        git clone --branch v0.7.4 https://github.com/pgvector/pgvector.git $TMP_PGV
        cd $TMP_PGV
        PATH=$PG_BIN:$PATH make
        PATH=$PG_BIN:$PATH make install
        cd / && rm -rf $TMP_PGV
    fi
fi

# DB / 사용자 / 확장 생성 (멱등)
DB_NAME=${DB_NAME:-oaas_prd}    # DEV 셋업 시 DB_NAME=oaas_dev로 export 후 실행
DB_USER=${DB_USER:-oaas}
DB_PASS=${DB_PASS:-changeme}     # 운영에서는 반드시 export DB_PASS=...로 덮어쓰기

sudo -u postgres psql <<SQL || true
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';
CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};
\\c ${DB_NAME}
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL ON SCHEMA public TO ${DB_USER};
SQL

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
