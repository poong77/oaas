/**
 * 8_OA_AS CI/CD Pipeline (Gitea + Jenkins)
 *
 * 브랜치 전략:
 *   develop → DEV 서버 자동 배포
 *   main    → PRD 서버 수동 승인 후 배포
 *
 * 참고: OA-ONE 8-stage 파이프라인에서 frontend 분리(S3+CloudFront) 단계를 제거하고
 *      Next.js standalone 단일 노드 배포로 6 stages로 압축. DB 마이그레이션 단계 통합.
 *
 * 필요한 Jenkins 설정:
 *   [플러그인]
 *   - Pipeline
 *   - SSH Agent
 *   - Credentials Binding
 *   - Slack Notification (선택)
 *   - Gitea (선택)
 *
 *   [Credentials] (Jenkins > Manage Credentials)
 *   - ec2-ssh-key             : SSH Username with private key (EC2 접속용)
 *   - oaas-slack-bot-token   : Secret text (Slack Bot Token xoxb-..., 선택)
 *
 *   [환경변수] (Jenkins Manage Jenkins > System > Global properties > Environment variables)
 *   다른 프로젝트와 충돌 방지를 위해 OAAS_ 프리픽스 사용.
 *   - OAAS_DEV_EC2_HOST     : DEV EC2 Private IP
 *   - OAAS_PRD_EC2_HOST     : PRD EC2 Private IP
 *   - OAAS_DEV_PUBLIC_URL   : DEV 공개 URL (https://as-dev.oapms.co)
 *   - OAAS_PRD_PUBLIC_URL   : PRD 공개 URL (https://support.oapms.com)
 *   - OAAS_SLACK_CHANNEL    : Slack 채널명 (예: #oaas-deploy, 선택)
 */

pipeline {
    agent any

    environment {
        APP_NAME    = 'oaas'
        NODE_IMAGE  = 'node:20'
        AWS_REGION  = 'ap-northeast-2'
        DEPLOY_PATH = '/app/oaas'
        EC2_USER    = 'ec2-user'
        APP_PORT    = '3000'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '20'))
    }

    stages {

        // ============================================================
        // 1. 환경 결정 (develop → DEV, main → PRD)
        // ============================================================
        stage('Environment') {
            steps {
                script {
                    def branch = env.BRANCH_NAME ?: env.GIT_BRANCH?.replaceAll('origin/', '') ?: 'develop'

                    if (branch == 'main') {
                        env.DEPLOY_ENV  = 'prd'
                        env.TARGET_HOST = env.OAAS_PRD_EC2_HOST
                        env.PUBLIC_URL  = env.OAAS_PRD_PUBLIC_URL
                    } else {
                        env.DEPLOY_ENV  = 'dev'
                        env.TARGET_HOST = env.OAAS_DEV_EC2_HOST
                        env.PUBLIC_URL  = env.OAAS_DEV_PUBLIC_URL
                    }

                    // 최근 커밋 작성자 (Gitea 계정명)
                    env.GIT_AUTHOR = sh(script: "git log -1 --format='%an'", returnStdout: true).trim()

                    echo "=========================================="
                    echo "  Deploy Environment : ${env.DEPLOY_ENV}"
                    echo "  Branch             : ${branch}"
                    echo "  Target Host        : ${env.TARGET_HOST}"
                    echo "  Public URL         : ${env.PUBLIC_URL}"
                    echo "  Author             : ${env.GIT_AUTHOR}"
                    echo "=========================================="
                }
            }
        }

        // ============================================================
        // 2. 빌드 (Docker node:20 + next build standalone)
        //
        //   산출물:
        //     .next/standalone/            (server.js + 의존 node_modules 일부)
        //     .next/static/                (정적 자산 — standalone에 자동 복사되지 않음)
        //     public/                       (public 자산)
        // ============================================================
        stage('Build') {
            steps {
                echo '📦 Building Next.js (standalone)...'
                // 이전 빌드의 .next 캐시 정리 (stale artifact 방지)
                sh "rm -rf \${WORKSPACE}/.next \${WORKSPACE}/*.tsbuildinfo"
                sh """docker run --rm \
                    -v \${WORKSPACE}:/app \
                    -w /app \
                    -e HOME=/tmp \
                    -e NEXT_TELEMETRY_DISABLED=1 \
                    --user \$(id -u):\$(id -g) \
                    ${NODE_IMAGE} \
                    sh -c 'npm ci && npm run build'"""

                // standalone 빌드 검증
                sh "test -f \${WORKSPACE}/.next/standalone/server.js || (echo 'standalone server.js 없음 — next.config.ts에 output:standalone 설정 확인' && exit 1)"
            }
        }

        // ============================================================
        // 3. PRD 수동 승인 (main 브랜치만)
        // ============================================================
        stage('PRD Approval') {
            when {
                expression { env.DEPLOY_ENV == 'prd' }
            }
            steps {
                script {
                    try {
                        slackSend(
                            channel: env.OAAS_SLACK_CHANNEL ?: '#oaas-deploy',
                            color: 'warning',
                            botUser: true,
                            tokenCredentialId: 'oaas-slack-bot-token',
                            message: """🚀 *통합AS PRD 배포 승인 대기*
• 환경: ${env.DEPLOY_ENV?.toUpperCase()}
• 브랜치: ${env.BRANCH_NAME ?: env.GIT_BRANCH}
• 커밋: ${env.GIT_COMMIT?.take(8) ?: 'unknown'}
• 요청자: ${env.GIT_AUTHOR ?: 'unknown'}"""
                        )
                    } catch (e) {
                        echo "Slack 알림 전송 실패 (무시): ${e.message}"
                    }
                }
                script {
                    try {
                        timeout(time: 60, unit: 'MINUTES') {
                            input message: '프로덕션 배포를 승인하시겠습니까?',
                                  ok: '배포 승인',
                                  submitter: ''
                        }
                    } catch (err) {
                        try {
                            slackSend(
                                channel: env.OAAS_SLACK_CHANNEL ?: '#oaas-deploy',
                                color: '#808080',
                                botUser: true,
                                tokenCredentialId: 'oaas-slack-bot-token',
                                message: """⛔ *통합AS PRD 배포 취소*
• 환경: ${env.DEPLOY_ENV?.toUpperCase()}
• 브랜치: ${env.BRANCH_NAME ?: env.GIT_BRANCH}
• 커밋: ${env.GIT_COMMIT?.take(8) ?: 'unknown'}
• 요청자: ${env.GIT_AUTHOR ?: 'unknown'}"""
                            )
                        } catch (slackErr) {
                            echo "Slack 알림 전송 실패 (무시): ${slackErr.message}"
                        }
                        error('PRD 배포가 취소되었습니다.')
                    }
                }
            }
        }

        // ============================================================
        // 4. 패키징 (standalone + static + public + 마이그레이션 + ecosystem)
        // ============================================================
        stage('Package') {
            steps {
                echo '📦 Packaging deploy artifact...'
                sh '''
                    cd ${WORKSPACE}
                    # standalone build에 누락된 static/public 추가
                    # (Next.js standalone은 .next/standalone/.next/static과 public을 별도 복사 필요)
                    mkdir -p .next/standalone/.next
                    cp -r .next/static .next/standalone/.next/static
                    if [ -d public ]; then
                        cp -r public .next/standalone/public
                    fi
                    tar -czf deploy.tar.gz \
                      -C .next standalone \
                      -C ${WORKSPACE} db/migrations db/schema \
                                       package.json package-lock.json drizzle.config.ts
                '''
            }
        }

        // ============================================================
        // 5. 배포 (EC2 + drizzle migrate + PM2 reload)
        // ============================================================
        stage('Deploy') {
            steps {
                echo "🚀 Deploying to ${env.DEPLOY_ENV}..."
                sshagent(credentials: ['ec2-ssh-key']) {
                    sh """scp -o StrictHostKeyChecking=no \
                        \${WORKSPACE}/deploy.tar.gz \
                        ${EC2_USER}@${env.TARGET_HOST}:/tmp/"""

                    sh """scp -o StrictHostKeyChecking=no \
                        \${WORKSPACE}/deploy/ecosystem.${env.DEPLOY_ENV}.config.js \
                        ${EC2_USER}@${env.TARGET_HOST}:/tmp/ecosystem.config.js"""

                    sh """ssh -o StrictHostKeyChecking=no ${EC2_USER}@${env.TARGET_HOST} << 'ENDSSH'
set -e

echo ">>> Backup current version..."
if [ -d ${DEPLOY_PATH}/standalone ]; then
    BACKUP_DIR="${DEPLOY_PATH}/backups/\$(date +%Y%m%d_%H%M%S)"
    mkdir -p \$BACKUP_DIR
    cp -r ${DEPLOY_PATH}/standalone \$BACKUP_DIR/
    echo "Backup saved to \$BACKUP_DIR"
fi

echo ">>> Clean old runtime and extract new version..."
cd ${DEPLOY_PATH}
rm -rf standalone db/migrations db/schema package.json package-lock.json drizzle.config.ts
tar -xzf /tmp/deploy.tar.gz

echo ">>> Prepare migrator (격리된 마이그레이션 전용 디렉토리)..."
# /app/oaas/migrator/ 에 drizzle-kit + 최소 의존성만 둔다.
# runtime(standalone/)을 오염시키지 않고 멱등 install (이미 있으면 스킵).
mkdir -p ${DEPLOY_PATH}/migrator
if [ ! -d ${DEPLOY_PATH}/migrator/node_modules ]; then
    cat > ${DEPLOY_PATH}/migrator/package.json <<EOF
{"name":"oaas-migrator","private":true,"version":"0.0.0"}
EOF
    (cd ${DEPLOY_PATH}/migrator && npm install --no-audit --no-fund \
        drizzle-kit drizzle-orm pg dotenv)
fi

# drizzle.config.ts는 dotenv/config를 import 한다 → /app/oaas/node_modules에서 dotenv를 찾아야 함.
# migrator의 node_modules를 /app/oaas/node_modules로 심볼릭링크 (runtime 영향 없음 — standalone은 standalone/node_modules 사용).
mkdir -p ${DEPLOY_PATH}/node_modules
for pkg in dotenv drizzle-kit drizzle-orm pg; do
    ln -sfn ${DEPLOY_PATH}/migrator/node_modules/\$pkg ${DEPLOY_PATH}/node_modules/\$pkg
done

# .env 심볼릭: /app/oaas/standalone/.env → /app/oaas/.env (cwd에서 dotenv가 자동 로드)
if [ -f ${DEPLOY_PATH}/standalone/.env ] && [ ! -L ${DEPLOY_PATH}/.env ]; then
    ln -sfn ${DEPLOY_PATH}/standalone/.env ${DEPLOY_PATH}/.env
fi

echo ">>> Run DB migrations (drizzle-kit migrate)..."
(cd ${DEPLOY_PATH} && ./migrator/node_modules/.bin/drizzle-kit migrate) || {
    echo "❌ migration 실패 — 배포 중단"
    exit 1
}

echo ">>> Copy ecosystem config..."
cp /tmp/ecosystem.config.js ${DEPLOY_PATH}/ecosystem.config.js

echo ">>> PM2 reload..."
cd ${DEPLOY_PATH}
pm2 reload ecosystem.config.js --update-env || pm2 start ecosystem.config.js

echo ">>> Cleanup old backups (keep last 5)..."
cd ${DEPLOY_PATH}/backups 2>/dev/null && ls -dt */ | tail -n +6 | xargs rm -rf 2>/dev/null || true

echo ">>> Cleanup temp files..."
rm -f /tmp/deploy.tar.gz /tmp/ecosystem.config.js

echo ">>> Deploy complete!"
ENDSSH"""
                }
            }
        }

        // ============================================================
        // 6. 헬스 체크 (5회 재시도)
        // ============================================================
        stage('Health Check') {
            steps {
                echo '🏥 Running Health Check...'
                sshagent(credentials: ['ec2-ssh-key']) {
                    sh """ssh -o StrictHostKeyChecking=no ${EC2_USER}@${env.TARGET_HOST} << 'ENDSSH'
echo "Waiting for server startup..."
sleep 5

for i in 1 2 3 4 5; do
    HTTP_CODE=\$(curl -s -o /tmp/health_response.json -w "%{http_code}" http://localhost:${APP_PORT}/api/health)
    if [ "\$HTTP_CODE" = "200" ]; then
        echo "Health check passed! (HTTP \$HTTP_CODE)"
        cat /tmp/health_response.json | python3 -m json.tool 2>/dev/null || cat /tmp/health_response.json
        rm -f /tmp/health_response.json
        exit 0
    fi
    echo "Attempt \$i: HTTP \$HTTP_CODE - retrying in 3s..."
    sleep 3
done

echo "Health check FAILED after 5 attempts"
rm -f /tmp/health_response.json
exit 1
ENDSSH"""
                }
            }
        }
    }

    // ================================================================
    // Post Actions
    // ================================================================
    post {
        success {
            script {
                try {
                    slackSend(
                        channel: env.OAAS_SLACK_CHANNEL ?: '#oaas-deploy',
                        color: 'good',
                        botUser: true,
                        tokenCredentialId: 'oaas-slack-bot-token',
                        message: """✅ *통합AS ${env.DEPLOY_ENV?.toUpperCase()} 배포 완료!*
• 프로그램: 8_OA_AS (support.oapms.com)
• 환경: ${env.DEPLOY_ENV?.toUpperCase()}
• 브랜치: ${env.BRANCH_NAME ?: env.GIT_BRANCH}
• 커밋: ${env.GIT_COMMIT?.take(8) ?: 'unknown'}
• 요청자: ${env.GIT_AUTHOR ?: 'unknown'}
• URL: ${env.PUBLIC_URL ?: '-'}
• 소요시간: ${currentBuild.durationString?.replace(' and counting', '')}"""
                    )
                } catch (e) {
                    echo "Slack 알림 전송 실패 (무시): ${e.message}"
                }
            }
        }

        failure {
            script {
                try {
                    slackSend(
                        channel: env.OAAS_SLACK_CHANNEL ?: '#oaas-deploy',
                        color: 'danger',
                        botUser: true,
                        tokenCredentialId: 'oaas-slack-bot-token',
                        message: """❌ *통합AS ${env.DEPLOY_ENV?.toUpperCase()} 배포 실패*
• 프로그램: 8_OA_AS
• 환경: ${env.DEPLOY_ENV?.toUpperCase()}
• 브랜치: ${env.BRANCH_NAME ?: env.GIT_BRANCH}
• 커밋: ${env.GIT_COMMIT?.take(8) ?: 'unknown'}
• 요청자: ${env.GIT_AUTHOR ?: 'unknown'}
• 소요시간: ${currentBuild.durationString?.replace(' and counting', '')}"""
                    )
                } catch (e) {
                    echo "Slack 알림 전송 실패 (무시): ${e.message}"
                }
            }
        }

        // post cleanup 블록 제거:
        //   sh는 hudson.FilePath (node 컨텍스트)를 요구하는데, 일찍 실패한 빌드에선
        //   post 시점에 그 컨텍스트가 없어 MissingContextVariableException 발생.
        //   deploy.tar.gz는 다음 빌드의 Package stage에서 덮어쓰기 → 누적 안 함.
    }
}
