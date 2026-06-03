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
  AUTH_DEV_STUB: process.env.AUTH_DEV_STUB ?? '',

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

  // Vercel Blob (Phase 5 — 첨부 파일 업로드)
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ?? '',

  // Slack (Phase 5) — Bot Token + chat.postMessage 방식.
  // 운영 환경(Vercel)에 SLACK_BOT_TOKEN + SLACK_CHANNEL_* (채널 ID `C...`) 등록.
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN ?? '',
  SLACK_CHANNEL_NEW: process.env.SLACK_CHANNEL_NEW ?? '',
  SLACK_CHANNEL_URGENT: process.env.SLACK_CHANNEL_URGENT ?? '',
  SLACK_CHANNEL_DEV: process.env.SLACK_CHANNEL_DEV ?? '',
  /** support.oapms.com URL — 알림 본문의 티켓 링크 생성에 사용. */
  PUBLIC_BASE_URL:
    process.env.PUBLIC_BASE_URL ?? process.env.NEXTAUTH_URL ?? '',

  // Chatbot (Phase 8)
  OACHAT_EMBED_URL: process.env.OACHAT_EMBED_URL ?? '',

  // Cron 인증 (rich-editor 후속 — editor_drafts 30일 정리)
  CRON_SECRET: process.env.CRON_SECRET ?? '',

  // OpenAI (Phase 2 — 시맨틱 검색 임베딩)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  OPENAI_EMBEDDING_MODEL:
    process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
} as const;

export function isDbConfigured(): boolean {
  return env.DATABASE_URL.length > 0 && env.DATABASE_URL.startsWith('postgres');
}

/** 시맨틱 검색용 OpenAI 키 설정 여부. 미설정 시 키워드 검색으로 graceful degrade. */
export function isOpenAIConfigured(): boolean {
  return env.OPENAI_API_KEY.length > 0;
}
