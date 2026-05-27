'use client';

/**
 * 글로벌 ConfirmDialog
 *
 * 사용법:
 *   const confirm = useConfirmDialog();
 *   const ok = await confirm({ title, description, confirmText, cancelText, tone });
 *
 * 룰:
 *   - window.confirm() / window.alert() 사용 금지 (CLAUDE.md)
 *   - 한 번에 하나만 노출되며 Promise<boolean> 반환
 */

import * as Dialog from '@radix-ui/react-dialog';
import { create } from 'zustand';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'danger';

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: Tone;
};

type ConfirmState = {
  open: boolean;
  options: ConfirmOptions | null;
  resolver: ((value: boolean) => void) | null;
  request: (options: ConfirmOptions) => Promise<boolean>;
  resolve: (value: boolean) => void;
};

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  options: null,
  resolver: null,
  request: (options) =>
    new Promise<boolean>((resolve) => {
      // 이미 열려있다면 직전 요청은 false로 닫고 새 요청을 띄움
      const prev = get().resolver;
      if (prev) prev(false);
      set({ open: true, options, resolver: resolve });
    }),
  resolve: (value) => {
    const { resolver } = get();
    resolver?.(value);
    set({ open: false, options: null, resolver: null });
  },
}));

/** 컴포넌트 어디서나 호출 가능한 hook */
export function useConfirmDialog() {
  return useConfirmStore((s) => s.request);
}

/** RootLayout에 한 번만 마운트 */
export function ConfirmDialogHost() {
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const resolve = useConfirmStore((s) => s.resolve);

  const isDanger = options?.tone === 'danger';

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) resolve(false);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-xl outline-none dark:border-slate-700 dark:bg-slate-900',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          )}
        >
          <Dialog.Title className="text-base font-semibold text-slate-900 dark:text-slate-50">
            {options?.title ?? '확인'}
          </Dialog.Title>
          {options?.description && (
            <Dialog.Description className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {options.description}
            </Dialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => resolve(false)}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {options?.cancelText ?? '취소'}
            </button>
            <button
              type="button"
              onClick={() => resolve(true)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium text-white shadow-sm',
                isDanger
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-brand-600 hover:bg-brand-500',
              )}
            >
              {options?.confirmText ?? '확인'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
