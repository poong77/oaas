import type { NextConfig } from 'next';

/**
 * Phase 10 보안 헤더 — 통합AS 프로덕션 정책.
 *
 * CSP: 외부 챗봇(oachat.ai)은 iframe으로 임베드되므로 `frame-src` 허용.
 *      Vercel Blob 다운로드 URL은 `*.public.blob.vercel-storage.com` / `*.private.blob.vercel-storage.com`.
 *      이미지/미디어 (티켓 첨부)는 위 도메인 + Neon 응답 X.
 *      HMR/turbopack을 위해 dev에서는 `unsafe-eval` 허용 (production에선 strict).
 */
const isProd = process.env.NODE_ENV === 'production';

const cspDirectives = [
  "default-src 'self'",
  // Next 16 inline boot scripts + turbopack dev
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://*.private.blob.vercel-storage.com",
  "media-src 'self' blob: https://*.public.blob.vercel-storage.com https://*.private.blob.vercel-storage.com",
  "font-src 'self' data:",
  // SES/Slack/Solapi/Neon outbound는 모두 서버 사이드 — 브라우저 connect는 self + Vercel Blob upload
  "connect-src 'self' https://*.public.blob.vercel-storage.com https://*.private.blob.vercel-storage.com https://blob.vercel-storage.com",
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
  // server-only 라이브러리 외부 처리 (bundler가 client chunk로 끌고 가지 못하게)
  // @anthropic-ai/sdk: 내부 agent-toolset이 node:fs/promises를 require하여
  //   Turbopack chunking 컨텍스트에서 실패 → 무조건 external 필요
  // sharp: 네이티브 바인딩 (libvips), server-only
  serverExternalPackages: [
    'bcryptjs',
    '@neondatabase/serverless',
    'solapi',
    '@slack/web-api',
    '@vercel/blob',
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
