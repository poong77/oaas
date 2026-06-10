'use client';

/**
 * LoginForm — 로그인 화면 시안 폼 (Figma node 22:11084).
 *
 * - 이메일/아이디 · 비밀번호 입력 + 로그인 버튼
 * - 비밀번호 마스킹 토글(눈 아이콘)
 * - 비밀번호 찾기 링크
 *
 * 시안용으로 실제 인증(/login NextAuth)에는 미연결 상태.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // 시안 데모 — 실제 인증 없이 로그인 후 홈으로 이동.
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    router.push('/landing/home');
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
      <input
        type="text"
        autoComplete="username"
        placeholder="이메일 주소 또는 아이디"
        className="h-[52px] w-full rounded-lg border border-[#DCDEE3] px-4 text-base text-[#1A1C20] placeholder:text-[#B0B3BA] focus:border-[#00A36B] focus:outline-none"
      />

      <div className="relative">
        <input
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="비밀번호"
          className="h-[52px] w-full rounded-lg border border-[#DCDEE3] pl-4 pr-12 text-base text-[#1A1C20] placeholder:text-[#B0B3BA] focus:border-[#00A36B] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 표시'}
          aria-pressed={showPassword}
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-md text-[#868B94] transition-colors hover:text-[#1A1C20]"
        >
          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>

      <button
        type="submit"
        className="mt-1 w-full rounded-lg bg-[#00A36B] py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#008A59]"
      >
        로그인
      </button>

      <div className="mt-1 flex items-center justify-center">
        <Link
          href="/landing/forgot-password"
          className="text-sm font-medium text-[#555D6D] transition-colors hover:text-[#00A36B]"
        >
          비밀번호 찾기
        </Link>
      </div>
    </form>
  );
}
