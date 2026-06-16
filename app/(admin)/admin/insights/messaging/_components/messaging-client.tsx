'use client';

/**
 * 메일&문자 발송 클라이언트 (MSG-15~23 개편).
 *
 * 탭 4개: 메일(SES) / 문자(Solapi) / 템플릿 / 메시지함.
 * - MSG-15 변수 값 패널, MSG-16 템플릿 탭+모달, MSG-17 엑셀 업로드, MSG-18 호텔리어 전체
 * - MSG-19 문자 제목 필수, MSG-20 메일 발신자명, MSG-21 미리보기, MSG-22 테스트 발송, MSG-23 메시지함 컬럼
 */

import { useState } from 'react';
import { Mail, MessageSquare, Inbox, Send } from 'lucide-react';
import { MailTab } from './mail-tab';
import { SmsTab } from './sms-tab';
import { TemplateTab } from './template-tab';
import { MessageBoxTab } from './messagebox-tab';
import type { Tab, TemplateSeed } from './shared';

export function MessagingClient({
  senderEmailLocal,
  senderPhone,
}: {
  senderEmailLocal: string;
  senderPhone: string;
}) {
  const [tab, setTab] = useState<Tab>('mail');
  // 템플릿 '사용' 시 채널 탭에 주입할 시드 (remount key로 초기화).
  const [mailSeed, setMailSeed] = useState<TemplateSeed | null>(null);
  const [smsSeed, setSmsSeed] = useState<TemplateSeed | null>(null);
  const [mailKey, setMailKey] = useState(0);
  const [smsKey, setSmsKey] = useState(0);

  function applyTemplate(seed: TemplateSeed) {
    if (seed.channel === 'email') {
      setMailSeed(seed);
      setMailKey((k) => k + 1);
      setTab('mail');
    } else {
      setSmsSeed(seed);
      setSmsKey((k) => k + 1);
      setTab('sms');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <TabButton active={tab === 'mail'} onClick={() => setTab('mail')} icon={<Mail className="h-4 w-4" />}>
          메일 발송
        </TabButton>
        <TabButton active={tab === 'sms'} onClick={() => setTab('sms')} icon={<MessageSquare className="h-4 w-4" />}>
          문자 발송
        </TabButton>
        <TabButton active={tab === 'template'} onClick={() => setTab('template')} icon={<Send className="h-4 w-4" />}>
          템플릿
        </TabButton>
        <TabButton active={tab === 'messagebox'} onClick={() => setTab('messagebox')} icon={<Inbox className="h-4 w-4" />}>
          메시지함
        </TabButton>
      </div>

      {tab === 'mail' ? (
        <MailTab key={mailKey} senderEmailLocal={senderEmailLocal} seed={mailSeed} />
      ) : tab === 'sms' ? (
        <SmsTab key={smsKey} senderPhone={senderPhone} seed={smsSeed} />
      ) : tab === 'template' ? (
        <TemplateTab onUse={applyTemplate} />
      ) : (
        <MessageBoxTab />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        '-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ' +
        (active
          ? 'border-brand-500 text-brand-700 dark:border-brand-400 dark:text-brand-300'
          : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100')
      }
    >
      {icon}
      {children}
    </button>
  );
}
