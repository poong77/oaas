/**
 * 환경변수 안전 로더.
 * Phase 0에서는 모든 외부 키가 비어있을 수 있으므로 graceful degrade.
 * Phase 1 이후 zod로 강제 검증으로 전환 권장.
 */

export const env = {
  DATABASE_URL: process.env.DATABASE_URL ?? '',
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  // Auth (Phase 1)
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ?? '',
  NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? '',
  OA_SSO_CLIENT_ID: process.env.OA_SSO_CLIENT_ID ?? '',
  OA_SSO_CLIENT_SECRET: process.env.OA_SSO_CLIENT_SECRET ?? '',
  OA_SSO_ISSUER: process.env.OA_SSO_ISSUER ?? '',

  // SMS/Email (Phase 1)
  SOLAPI_API_KEY: process.env.SOLAPI_API_KEY ?? '',
  SOLAPI_API_SECRET: process.env.SOLAPI_API_SECRET ?? '',
  SOLAPI_SENDER: process.env.SOLAPI_SENDER ?? '',

  // AWS (Phase 5)
  AWS_REGION: process.env.AWS_REGION ?? '',
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ?? '',
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  SES_FROM_EMAIL: process.env.SES_FROM_EMAIL ?? '',
  S3_BUCKET: process.env.S3_BUCKET ?? '',

  // Slack (Phase 5)
  SLACK_WEBHOOK_NEW: process.env.SLACK_WEBHOOK_NEW ?? '',
  SLACK_WEBHOOK_URGENT: process.env.SLACK_WEBHOOK_URGENT ?? '',
  SLACK_WEBHOOK_DEV: process.env.SLACK_WEBHOOK_DEV ?? '',

  // Chatbot (Phase 8)
  OACHAT_EMBED_URL: process.env.OACHAT_EMBED_URL ?? '',
} as const;

export function isDbConfigured(): boolean {
  return env.DATABASE_URL.length > 0 && env.DATABASE_URL.startsWith('postgres');
}
