'use client';

/**
 * 단축키 도움말 모달.
 *
 * - Cmd+? 또는 F1로 열기 (RichEditor 내부 keymap에서 등록)
 * - mode='full' / 'lite'에 따라 다른 단축키 표시
 */

import { Fragment } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShortcutHelpModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'full' | 'lite';
}

interface ShortcutEntry {
  keys: string;
  label: string;
}

interface ShortcutGroup {
  title: string;
  entries: ShortcutEntry[];
}

const FULL_GROUPS: ShortcutGroup[] = [
  {
    title: '저장·발송',
    entries: [
      { keys: '⌘/Ctrl + S', label: '임시 저장 (즉시 draft)' },
      { keys: '⌘/Ctrl + Enter', label: '저장 + 발송 (공개 답변)' },
      { keys: '⌘/Ctrl + Shift + Enter', label: '저장 + Slack 발송 (내부 메모)' },
    ],
  },
  {
    title: '매니저 기능',
    entries: [
      { keys: '⌘/Ctrl + /', label: '빠른답변 패널 열기' },
      { keys: 'Ctrl + 1~9', label: '빠른답변 즉시 삽입 (패널에서)' },
      { keys: '/', label: '슬래시 커맨드 메뉴 (계획 중)' },
    ],
  },
  {
    title: '서식',
    entries: [
      { keys: '⌘/Ctrl + B', label: '굵게' },
      { keys: '⌘/Ctrl + I', label: '기울임' },
      { keys: '⌘/Ctrl + U', label: '밑줄' },
      { keys: '⌘/Ctrl + K', label: '링크 삽입/편집' },
      { keys: '⌘/Ctrl + E', label: '인라인 코드' },
      { keys: '⌘/Ctrl + Shift + C', label: '코드 블록' },
      { keys: '⌘/Ctrl + Alt + 1~3', label: '제목 1~3' },
      { keys: '⌘/Ctrl + Shift + 7', label: '번호 목록' },
      { keys: '⌘/Ctrl + Shift + 8', label: '글머리 목록' },
      { keys: '⌘/Ctrl + Shift + 9', label: '체크리스트' },
    ],
  },
  {
    title: '편집',
    entries: [
      { keys: '⌘/Ctrl + Z', label: '실행 취소' },
      { keys: '⌘/Ctrl + Shift + Z', label: '재실행' },
      { keys: 'Tab / Shift + Tab', label: '목록 들여쓰기 / 내어쓰기' },
      { keys: 'Esc', label: '모달·메뉴 닫기' },
    ],
  },
  {
    title: '입력 자동 변환',
    entries: [
      { keys: '# (공백)', label: '제목 1' },
      { keys: '## (공백)', label: '제목 2' },
      { keys: '- (공백)', label: '글머리 목록' },
      { keys: '1. (공백)', label: '번호 목록' },
      { keys: '- [ ] (공백)', label: '체크리스트' },
      { keys: '> (공백)', label: '인용' },
      { keys: '```', label: '코드 블록' },
      { keys: '---', label: '구분선' },
    ],
  },
];

const LITE_GROUPS: ShortcutGroup[] = [
  {
    title: '기본',
    entries: [
      { keys: '⌘/Ctrl + S', label: '임시 저장' },
      { keys: '⌘/Ctrl + B', label: '굵게' },
      { keys: '⌘/Ctrl + I', label: '기울임' },
      { keys: '⌘/Ctrl + K', label: '링크' },
      { keys: '⌘/Ctrl + Shift + 8', label: '글머리 목록' },
      { keys: '⌘/Ctrl + Shift + 9', label: '체크리스트' },
      { keys: '⌘/Ctrl + Z', label: '실행 취소' },
    ],
  },
];

export function ShortcutHelpModal({ open, onClose, mode }: ShortcutHelpModalProps) {
  if (!open) return null;
  const groups = mode === 'full' ? FULL_GROUPS : LITE_GROUPS;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="단축키 도움말"
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-md border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">
          단축키 도움말
        </h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Cmd+? 또는 F1로 언제든 열 수 있습니다. ({mode === 'full' ? '풀 모드' : '라이트 모드'})
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <Fragment key={group.title}>
              <section className="rounded border border-slate-200 p-3 dark:border-slate-700">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {group.title}
                </h3>
                <table className="w-full text-xs">
                  <tbody>
                    {group.entries.map((entry, i) => (
                      <tr
                        key={i}
                        className={cn(
                          i > 0 && 'border-t border-slate-100 dark:border-slate-800',
                        )}
                      >
                        <td className="whitespace-nowrap py-1.5 pr-2 align-top">
                          <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
                            {entry.keys}
                          </kbd>
                        </td>
                        <td className="py-1.5 text-slate-700 dark:text-slate-300">
                          {entry.label}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
