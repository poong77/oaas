/**
 * Slack Incoming Webhook 알림 (Phase 5 IC-06, IC-08).
 *
 * 3개 채널:
 *   - SLACK_WEBHOOK_NEW    → 신규 접수
 *   - SLACK_WEBHOOK_URGENT → urgency=p1 신규 접수
 *   - SLACK_WEBHOOK_DEV    → Dev 에스컬레이션
 *
 * 키 미설정 시 console.log로 stub 처리, ok 반환.
 * Webhook 한계상 thread_ts를 받지 못함 — 양방향 스레드 동기화는 추후 Bot Token으로 보강.
 */

import { env } from '@/lib/env';

export type SlackChannelKey = 'new' | 'urgent' | 'dev';

export type SlackBlock = Record<string, unknown>;

export type SendSlackInput = {
  channel: SlackChannelKey;
  /** Block Kit 메시지. */
  blocks: SlackBlock[];
  /** 알림(요약) 텍스트 — 모바일 push에 표시됨. */
  fallbackText: string;
};

export type SendSlackResult =
  | { ok: true; channel: SlackChannelKey; stub?: boolean }
  | { ok: false; channel: SlackChannelKey; error: string };

function webhookUrl(channel: SlackChannelKey): string {
  switch (channel) {
    case 'new':
      return env.SLACK_WEBHOOK_NEW;
    case 'urgent':
      return env.SLACK_WEBHOOK_URGENT;
    case 'dev':
      return env.SLACK_WEBHOOK_DEV;
  }
}

export async function sendSlack(input: SendSlackInput): Promise<SendSlackResult> {
  const url = webhookUrl(input.channel);

  if (!url) {
    console.log('[SLACK STUB]', {
      channel: input.channel,
      text: input.fallbackText,
      blocks: input.blocks.length,
    });
    return { ok: true, channel: input.channel, stub: true };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: input.fallbackText,
        blocks: input.blocks,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        ok: false,
        channel: input.channel,
        error: `Slack webhook ${res.status}: ${body.slice(0, 200)}`,
      };
    }
    return { ok: true, channel: input.channel };
  } catch (err) {
    return {
      ok: false,
      channel: input.channel,
      error: err instanceof Error ? err.message : 'unknown slack error',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Block Kit 빌더
// ─────────────────────────────────────────────────────────────────────

export type TicketSummaryForSlack = {
  ticketNo: string;
  title: string;
  productLabel: string;
  issueTypeLabel: string;
  urgencyLabel: string;
  impactLabel: string | null;
  hotelName: string | null;
  reporterName: string | null;
  reporterEmail: string | null;
  reporterPhone: string | null;
  contentExcerpt: string;
  attachmentCount: number;
  link: string;
};

export function buildTicketNewBlocks(t: TicketSummaryForSlack): SlackBlock[] {
  const lines: string[] = [];
  if (t.hotelName) lines.push(`*호텔:* ${t.hotelName}`);
  if (t.reporterName) {
    const contact = [t.reporterEmail, t.reporterPhone]
      .filter(Boolean)
      .join(' · ');
    lines.push(`*접수자:* ${t.reporterName}${contact ? ` (${contact})` : ''}`);
  }
  lines.push(`*제품:* ${t.productLabel}  |  *유형:* ${t.issueTypeLabel}`);
  lines.push(
    `*긴급도:* ${t.urgencyLabel}` +
      (t.impactLabel ? `  |  *영향범위:* ${t.impactLabel}` : ''),
  );
  if (t.attachmentCount > 0) {
    lines.push(`*첨부:* ${t.attachmentCount}개`);
  }

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `🆕 ${t.ticketNo}  ${t.title}` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n') },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `>${t.contentExcerpt.replace(/\n/g, '\n>')}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '큐에서 열기' },
          url: t.link,
          style: 'primary',
        },
      ],
    },
  ];
}

export function buildTicketUrgentBlocks(t: TicketSummaryForSlack): SlackBlock[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚨 [P1 긴급] ${t.ticketNo}  ${t.title}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*호텔:* ${t.hotelName ?? '-'}\n` +
          `*제품:* ${t.productLabel}  |  *유형:* ${t.issueTypeLabel}\n` +
          `*접수자:* ${t.reporterName ?? '-'} · ${t.reporterPhone ?? '-'}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `>${t.contentExcerpt.replace(/\n/g, '\n>')}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🔥 즉시 처리' },
          url: t.link,
          style: 'danger',
        },
      ],
    },
  ];
}

export type TicketEscalateForSlack = TicketSummaryForSlack & {
  escalatorName: string | null;
  reason: string;
};

export function buildTicketEscalateBlocks(
  t: TicketEscalateForSlack,
): SlackBlock[] {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🛠 [Dev 에스컬] ${t.ticketNo}  ${t.title}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          `*제품:* ${t.productLabel}  |  *유형:* ${t.issueTypeLabel}\n` +
          `*긴급도:* ${t.urgencyLabel}  |  *호텔:* ${t.hotelName ?? '-'}\n` +
          `*에스컬한 매니저:* ${t.escalatorName ?? '-'}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*에스컬 사유*\n>${t.reason.replace(/\n/g, '\n>')}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*원본 요약*\n>${t.contentExcerpt.replace(/\n/g, '\n>')}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '티켓 열기' },
          url: t.link,
        },
      ],
    },
  ];
}
