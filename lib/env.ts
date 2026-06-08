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
  /**
   * SES 전용 IAM User 키 (cross-account, oa-marketing 계정 발급).
   * S3는 같은 계정의 EC2 IAM Role(`oaas-IAM-role-ec2-prd`) 사용 → 키 불필요.
   * 둘을 분리한 이유: SES 키가 노출돼도 S3 첨부 권한엔 영향 없음 + S3 키 회전 부담 제거.
   *
   * ⚠️ .env에는 절대 `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`를 넣지 마라.
   * 들어있으면 AWS SDK가 자동으로 그 키를 잡아 IAM Role 폴백을 막는다.
   */
  SES_ACCESS_KEY_ID: process.env.SES_ACCESS_KEY_ID ?? '',
  SES_SECRET_ACCESS_KEY: process.env.SES_SECRET_ACCESS_KEY ?? '',
  SES_FROM_EMAIL: process.env.SES_FROM_EMAIL ?? '',
  /**
   * SES 전용 리전. 미설정 시 AWS_REGION 폴백.
   * S3(서울 ap-northeast-2)와 SES(시드니 ap-southeast-2 도메인 인증) 리전이 달라 분리.
   */
  SES_REGION: process.env.SES_REGION ?? '',

  // 첨부 파일 S3 (이전 Vercel Blob 대체).
  //   - S3_UPLOAD_BUCKET   : 업로드 대상 버킷 (예: as-uploads-prd).
  //   - S3_UPLOAD_PREFIX   : 키 prefix (선택, 멀티 테넌트/환경 구분용).
  //   - S3_UPLOAD_PUBLIC_URL: 공개 도메인 (CloudFront/S3 웹사이트, 예: https://files.support.oapms.com).
  //     설정 시 응답 URL은 `{PUBLIC_URL}/{key}` 형식, 미설정 시 S3 가상호스팅 URL.
  S3_UPLOAD_BUCKET: process.env.S3_UPLOAD_BUCKET ?? '',
  S3_UPLOAD_PREFIX: process.env.S3_UPLOAD_PREFIX ?? '',
  S3_UPLOAD_PUBLIC_URL: process.env.S3_UPLOAD_PUBLIC_URL ?? '',

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

  // 대칭키 암호화 (호텔 솔루션 비밀번호 등). 미설정 시 NEXTAUTH_SECRET 파생.
  // 운영 권장: 32바이트 키를 hex 64자로. `openssl rand -hex 32`
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? '',

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

/**
 * 알림/이메일 본문의 절대 링크 생성을 위한 공개 베이스 URL.
 * 우선순위: PUBLIC_BASE_URL → NEXTAUTH_URL → localhost.
 * 반환값은 항상 프로토콜 포함, 끝의 슬래시 제거.
 */
export function getPublicBaseUrl(): string {
  const raw = env.PUBLIC_BASE_URL || env.NEXTAUTH_URL || 'http://localhost:3000';
  return raw.replace(/\/$/, '');
}
