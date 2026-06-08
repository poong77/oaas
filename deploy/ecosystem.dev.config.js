/**
 * PM2 Ecosystem Config — 8_OA_AS DEV
 *
 * Next.js standalone 진입점 = ./standalone/server.js
 * EC2: t3.small (2 vCPU, 2GB RAM)
 *
 * 사용법:
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js --update-env
 *   pm2 logs oaas
 */
module.exports = {
  apps: [
    {
      name: 'oaas',
      script: './standalone/server.js',
      cwd: '/app/oaas',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      // .env 로드: standalone/.env (배포 산출물 함께 묶이는 위치)
      // dotenv-cli 없이도 Next 16 standalone은 process.env만 사용하므로
      // PM2가 환경변수를 주입해야 한다. .env는 generate-env.sh가 만든다.
      // (별도 dotenv 모듈 import 없음)
      // 로그
      error_file: '/app/oaas/logs/pm2-error.log',
      out_file: '/app/oaas/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 프로세스 관리
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      // 안정성
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
    },
  ],
};
