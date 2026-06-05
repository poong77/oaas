/**
 * Next.js 16 Proxy (구 middleware).
 *
 * 접근 정책 (2026-06-05 변경 — 비공개 서비스화):
 *   - 공개 경로는 랜딩(/) · 로그인(/login) 뿐. 그 외 모든 페이지는 로그인 필요.
 *   - 비로그인 접근 시 /login?callbackUrl=... 로 리다이렉트.
 *   - 랜딩의 팝업 배너/티커는 공개 노출되나, 클릭 대상(공지 상세 등)이 보호 경로이므로
 *     클릭 시 자연스럽게 로그인 플로우로 유도된다.
 *   - /api/* (인증 API 포함)는 각 핸들러가 자체 인증하므로 프록시 게이트에서 제외
 *     (API 호출에 로그인 페이지 리다이렉트를 돌려주지 않기 위함).
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

/** 로그인 없이 접근 가능한 페이지 (정확 매칭). */
const PUBLIC_PATHS = new Set<string>(['/', '/login']);

// NextAuth의 auth() wrap을 default export(=proxy)로 노출
export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  // 서버 컴포넌트(RoleScope 등)가 현재 경로를 읽을 수 있도록 x-pathname 주입
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  const pass = NextResponse.next({ request: { headers: requestHeaders } });

  // /api/* 는 자체 인증 — 게이트 제외 (단 x-pathname은 유지)
  if (pathname.startsWith('/api')) return pass;

  const isPublic = PUBLIC_PATHS.has(pathname);
  if (isPublic || req.auth) return pass;

  // 보호 경로 비로그인 접근 → 로그인 화면으로 (복귀 경로 부착)
  const url = new URL('/login', req.nextUrl.origin);
  url.searchParams.set('callbackUrl', `${pathname}${search}`);
  return NextResponse.redirect(url);
});

// 정적 파일·NextAuth API는 제외
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\..*).*)'],
};
