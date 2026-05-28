'use client';

/**
 * ChatbotFab — Phase 8 (CB-01 / CB-02 / CB-03).
 *
 * - 모든 페이지 우하단 fixed 플로팅 버튼 (호텔리어 컨텍스트)
 * - 노출 제외 경로: /login, /admin/*, /profile/staff
 * - 클릭 → iframe 컨테이너 펼침 (애니메이션)
 * - iframe `src={embedUrl}`, lazy load (펼친 후 mount)
 * - embedUrl 비어있으면 fallback 카드 ("문의 접수" 안내)
 * - 모바일 풀스크린 모드
 * - z-index: FAB는 z-40, 펼친 패널은 z-50 (긴급 배너와 동일하지만 마지막에 렌더되어 자연스럽게 위로)
 *
 * 임시값:
 *   // TODO(phase-8-temp): OACHAT_EMBED_URL이 비어있을 때 fallback 카드 노출
 *   // TODO(phase-8-temp): CB-04 — 챗봇 미해결 → 접수 폼 pre-fill (Phase 9+)
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MessageCircle, X, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const EXCLUDED_PREFIXES = ['/login', '/admin', '/profile/staff'];

function shouldHide(pathname: string): boolean {
  for (const prefix of EXCLUDED_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return true;
  }
  return false;
}

export function ChatbotFab({ embedUrl }: { embedUrl: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // ESC로 닫기
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // 모바일 풀스크린일 때 body scroll lock
  useEffect(() => {
    if (!open) return;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    if (!isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (shouldHide(pathname)) return null;

  const hasEmbed = embedUrl.trim().length > 0;

  return (
    <>
      {/* FAB */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="챗봇 열기"
          className="fixed bottom-3 right-3 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 transition-transform hover:scale-105 hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 sm:bottom-4 sm:right-4 sm:h-14 sm:w-14"
        >
          <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>
      )}

      {/* 펼친 패널 */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="OA 챗봇"
          className={cn(
            'fixed z-50 flex flex-col overflow-hidden bg-white shadow-2xl dark:bg-slate-950',
            // 모바일 풀스크린
            'inset-0 sm:inset-auto',
            // 데스크탑: 우하단 패널
            'sm:bottom-4 sm:right-4 sm:h-[600px] sm:max-h-[80vh] sm:w-96 sm:rounded-2xl sm:border sm:border-slate-200 sm:dark:border-slate-800',
          )}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-slate-200 bg-brand-600 px-4 py-3 text-white dark:border-slate-800">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <span className="font-semibold">OA 챗봇</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="챗봇 닫기"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/90 hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 본문 */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {hasEmbed ? (
              <>
                {/* 로딩 표시 (iframe 로드 전) */}
                {!iframeLoaded && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                    <span>챗봇을 불러오는 중...</span>
                  </div>
                )}
                <iframe
                  src={embedUrl}
                  title="OA 챗봇"
                  className={cn(
                    'flex-1 border-0',
                    iframeLoaded ? 'block' : 'hidden',
                  )}
                  onLoad={() => setIframeLoaded(true)}
                  // 챗봇 도메인 외부이므로 sandbox는 느슨하게 (form 제출, 스크립트 허용)
                  // TODO(phase-8-temp): 실제 oachat.ai 도메인 화이트리스트 정책 확정 후 sandbox 조정
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </>
            ) : (
              <ChatbotFallback />
            )}
          </div>

          {/* 하단 안내 */}
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            챗봇이 해결되지 않으면{' '}
            <Link
              href="/tickets/new?from=chatbot"
              className="font-medium text-brand-600 hover:underline dark:text-brand-400"
              onClick={() => setOpen(false)}
            >
              문의 접수
            </Link>
            를 이용해주세요.
          </div>
        </div>
      )}
    </>
  );
}

function ChatbotFallback() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8 text-center">
      <div className="rounded-full bg-brand-100 p-3 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">
        <MessageCircle className="h-6 w-6" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">챗봇은 곧 제공됩니다</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          현재 챗봇이 준비 중입니다. 지금은 문의 접수를 이용해주세요.
        </p>
      </div>
      <Link
        href="/tickets/new?from=chatbot"
        className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
      >
        문의 접수하기
        <ArrowUpRight className="h-4 w-4" />
      </Link>
      <ul className="mt-2 text-left text-xs text-slate-500 dark:text-slate-400">
        <li>· 도움말 검색: 상단 검색창에서 키워드 입력</li>
        <li>· FAQ: /faq 에서 자주 묻는 질문 확인</li>
        <li>· 서비스 상태: /status 에서 운영 상태 확인</li>
      </ul>
    </div>
  );
}
