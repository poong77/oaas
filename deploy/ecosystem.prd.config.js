/**
 * PM2 Ecosystem Config — 8_OA_AS PRD
 *
 * Next.js standalone 진입점 = ./standalone/server.js
 * EC2: t3.medium (2 vCPU, 4GB RAM)
 * Scale-up: PG와 동일 노드 분리 시 instances: 2, exec_mode: 'cluster'로 변경 가능
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
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
      },
      // 로그
      error_file: '/app/oaas/logs/pm2-error.log',
      out_file: '/app/oaas/logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      // 프로세스 관리
      autorestart: true,
      watch: false,
      max_memory_restart: '1.5G',
      // 안정성
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 3000,
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
    },
  ],
};
