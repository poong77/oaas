import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // CSP는 Phase 1에서 SSO·외부키 확정 후 강화 예정
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // bcryptjs / drizzle 등 server-only 라이브러리 외부 처리
  serverExternalPackages: [
    'bcryptjs',
    '@neondatabase/serverless',
    'solapi',
    '@slack/web-api',
    '@vercel/blob',
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
