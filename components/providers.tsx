'use client';

import { ThemeProvider } from 'next-themes';
import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { ConfirmDialogHost } from '@/components/dialogs/confirm-dialog';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="oa-support-theme"
        disableTransitionOnChange
      >
        {children}
        <ConfirmDialogHost />
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            classNames: {
              toast:
                'group rounded-lg border border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
            },
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
