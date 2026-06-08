import type { NextConfig } from 'next';

/**
 * 보안 헤더 + 배포 산출물.
 *
 * 배포 모델:
 *   - 자체 호스팅(EC2 + Nginx + PM2). Vercel 사용 안 함.
 *   - `output: 'standalone'` → `.next/standalone/server.js` 단일 진입점 (PM2가 실행).
 *
 * CSP:
 *   - 외부 챗봇(oachat.ai)은 iframe으로 임베드되므로 `frame-src` 허용.
 *   - 첨부/이미지: 자체 S3/CloudFront 도메인. `S3_UPLOAD_PUBLIC_URL` 환경변수 기반으로
 *     CSP에 동적으로 host 추가. 미설정 시에는 self만 허용.
 *   - HMR/turbopack을 위해 dev에서는 `unsafe-eval` 허용 (production에선 strict).
 */
const isProd = process.env.NODE_ENV === 'production';

/** S3 공개 URL에서 origin(https://host)을 추출. 빈 문자열 안전. */
function originOf(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    const u = new URL(rawUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
}

const uploadPublicOrigin = originOf(process.env.S3_UPLOAD_PUBLIC_URL ?? '');
const extraImgSources = uploadPublicOrigin ? ` ${uploadPublicOrigin}` : '';

const cspDirectives = [
  "default-src 'self'",
  // Next 16 inline boot scripts + turbopack dev
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${extraImgSources}`,
  `media-src 'self' blob:${extraImgSources}`,
  "font-src 'self' data:",
  // SES/Slack/Solapi/PG outbound는 모두 서버 사이드 — 브라우저 connect는 self만 필요
  `connect-src 'self'${extraImgSources}`,
  // 챗봇 iframe (oachat.ai), 외부 차단
  "frame-src 'self' https://*.oachat.ai https://oachat.ai",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  isProd ? 'upgrade-insecure-requests' : '',
]
  .filter(Boolean)
  .join('; ');

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // 로그인 기반 비공개 서비스 — 검색 엔진 색인/크롤링 차단 (헤더 레벨 방어)
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'Content-Security-Policy', value: cspDirectives },
  // HSTS는 프로덕션에서만 (로컬 https 환경 영향 회피)
  ...(isProd
    ? [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // PM2가 .next/standalone/server.js를 실행한다 (Dockerfile/Jenkins 산출물 최소화).
  output: 'standalone',
  // server-only 라이브러리 외부 처리 (bundler가 client chunk로 끌고 가지 못하게)
  // @anthropic-ai/sdk: 내부 agent-toolset이 node:fs/promises를 require하여
  //   Turbopack chunking 컨텍스트에서 실패 → 무조건 external 필요
  // sharp: 네이티브 바인딩 (libvips), server-only
  // pg: native pg-native binding 회피, server-only
  serverExternalPackages: [
    'bcryptjs',
    'pg',
    'solapi',
    '@slack/web-api',
    '@aws-sdk/client-s3',
    '@aws-sdk/client-sesv2',
    '@anthropic-ai/sdk',
    'sharp',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
