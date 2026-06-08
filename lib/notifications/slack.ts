/**
 * Slack 알림 (Phase 5 IC-06, IC-08) — Bot Token `chat.postMessage` 방식.
 *
 * 운영 환경 변수 (Vercel 등록):
 *   - SLACK_BOT_TOKEN     → `xoxb-...` Bot User OAuth Token (scope: chat:write)
 *   - SLACK_CHANNEL_NEW    → 신규 접수            (#support_new,    채널 ID `C...`)
 *   - SLACK_CHANNEL_URGENT → urgency=p1 신규 접수 (#support_urgent, 채널 ID `C...`)
 *   - SLACK_CHANNEL_DEV    → Dev 에스컬레이션      (#support_escalation, 채널 ID `C...`)
 *
 * 토큰/채널 미설정 시 stub 처리(ok 반환). 단, 프로덕션에서 미설정이면 console.warn으로
 * 표면화한다 — 과거 "보낸 척 ok:true"로 장애가 묻혔던 회귀 방지.
 *
 * 봇이 미리 해당 채널에 초대(/invite @bot)되어 있어야 발송 가능(not_in_channel 에러 방지).
 */

import { env } from '@/lib/env';
import { markdownToSlackMrkdwn } from '@/lib/editor/markdown-to-slack-mrkdwn';

const SLACK_POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';

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
  | { ok: true; channel: SlackChannelKey; stub?: boolean; ts?: string }
  | { ok: false; channel: SlackChannelKey; error: string };

/** 채널 키 → Slack 채널 ID. */
function channelId(channel: SlackChannelKey): string {
  switch (channel) {
    case 'new':
      return env.SLACK_CHANNEL_NEW;
    case 'urgent':
      return env.SLACK_CHANNEL_URGENT;
    case 'dev':
      return env.SLACK_CHANNEL_DEV;
  }
}

export async function sendSlack(input: SendSlackInput): Promise<SendSlackResult> {
  const token = env.SLACK_BOT_TOKEN;
  const channel = channelId(input.channel);

  // 토큰 또는 채널 ID 미설정 → stub. 프로덕션이면 경고를 남겨 누락을 표면화.
  if (!token || !channel) {
    const detail = {
      channel: input.channel,
      hasToken: Boolean(token),
      hasChannelId: Boolean(channel),
      text: input.fallbackText,
    };
    if (env.NODE_ENV === 'production') {
      console.warn(
        '[SLACK 미설정] 메시지 미발송 — SLACK_BOT_TOKEN/SLACK_CHANNEL_* 확인 필요',
        detail,
      );
    } else {
      console.log('[SLACK STUB]', detail);
    }
    return { ok: true, channel: input.channel, stub: true };
  }

  try {
    const res = await fetch(SLACK_POST_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        channel,
        text: input.fallbackText,
        blocks: input.blocks,
      }),
    });

    // chat.postMessage는 HTTP 200이어도 body.ok=false로 실패를 알린다(invalid_auth,
    // not_in_channel, channel_not_found 등). HTTP 상태만 봐선 안 됨.
    const data = (await res.json().catch(() => null)) as
      | { ok: boolean; ts?: string; error?: string }
      | null;

    if (!res.ok || !data || !data.ok) {
      const error = data?.error
        ? `Slack chat.postMessage 실패: ${data.error}`
        : `Slack chat.postMessage HTTP ${res.status}`;
      console.warn('[SLACK 발송 실패]', { channel: input.channel, error });
      return { ok: false, channel: input.channel, error };
    }

    return { ok: true, channel: input.channel, ts: data.ts };
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
        text: `>${markdownToSlackMrkdwn(t.contentExcerpt).replace(/\n/g, '\n>')}`,
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

/** 호텔리어가 접수 단계에서 '답변 보완'을 올렸을 때 운영팀 알림. */
export function buildAnswerSupplementBlocks(t: {
  ticketNo: string;
  title: string;
  hotelName: string | null;
  reporterName: string | null;
  contentExcerpt: string;
  link: string;
}): SlackBlock[] {
  const lines: string[] = [];
  if (t.hotelName) lines.push(`*호텔:* ${t.hotelName}`);
  if (t.reporterName) lines.push(`*작성자:* ${t.reporterName}`);
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: `💬 답변 보완  ${t.ticketNo}` },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${t.title}*${lines.length ? `\n${lines.join('\n')}` : ''}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `>${markdownToSlackMrkdwn(t.contentExcerpt).replace(/\n/g, '\n>')}`,
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
        text: `>${markdownToSlackMrkdwn(t.contentExcerpt).replace(/\n/g, '\n>')}`,
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
        text: `*에스컬 사유*\n>${markdownToSlackMrkdwn(t.reason).replace(/\n/g, '\n>')}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*원본 요약*\n>${markdownToSlackMrkdwn(t.contentExcerpt).replace(/\n/g, '\n>')}`,
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
