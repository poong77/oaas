/**
 * Next.js 16 Proxy (구 middleware).
 *
 * 비로그인 사용자가 보호 경로(/admin/*, /profile/*, /tickets/* 등)에 접근하면
 * /login으로 리다이렉트 (callbackUrl 포함).
 *
 * NextAuth v5 edge-safe 패턴:
 *   - lib/auth.config.ts (edge-safe, providers 없음)만 import
 *   - lib/auth.ts(DB·bcrypt 포함)는 edge에서 import하지 않는다
 *
 * Next 16에서 middleware.ts → proxy.ts로 이름 변경되었으며,
 * named export `proxy` (또는 default export)여야 한다.
 */

import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ['/admin', '/profile', '/tickets'];

// NextAuth의 auth() wrap을 default export(=proxy)로 노출
export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  // 서버 컴포넌트(RoleScope 등)가 현재 경로를 읽을 수 있도록 x-pathname 주입
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  if (isProtected && !req.auth) {
    const callbackUrl = `${pathname}${search}`;
    const url = new URL('/login', req.nextUrl.origin);
    url.searchParams.set('callbackUrl', callbackUrl);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
});

// 정적 파일·NextAuth API는 제외
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)'],
};
