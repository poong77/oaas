/**
 * Slack 어드민 헬퍼 — 채널 검색·조회·봇 입장 (2026-06-09).
 *
 * 호텔 ↔ Slack 채널 연동(`hotel_slack_channels`)에서 사용.
 * 발송용 `sendSlack`(slack.ts)과 별도로, 워크스페이스 채널 조작 API를 담당.
 *
 * 필요 OAuth 스코프 (Slack 앱에 추가 + 재설치 필요):
 *   - channels:read, groups:read  → conversations.list / conversations.info
 *   - channels:join               → conversations.join (공개 채널 봇 자동입장)
 *   - chat:write                  → (발송, 기존)
 *
 * 토큰 미설정 시 stub(빈 목록/실패)로 graceful degrade — 빌드/개발 환경 보호.
 */

import 'server-only';
import { env } from '@/lib/env';

const SLACK_API = 'https://slack.com/api';

export type SlackChannelLite = {
  id: string;
  name: string;
  isPrivate: boolean;
  /** 봇이 이미 해당 채널 멤버인지. */
  isMember: boolean;
  isArchived?: boolean;
};

/** 입력값이 Slack 채널 ID 패턴인지 (`C…`/`G…` 대문자+영숫자 8자 이상). */
export function looksLikeChannelId(raw: string): boolean {
  return /^[CG][A-Z0-9]{7,}$/.test(raw.trim());
}

type SlackListResponse = {
  ok: boolean;
  error?: string;
  channels?: Array<{
    id: string;
    name: string;
    is_private?: boolean;
    is_member?: boolean;
    is_archived?: boolean;
  }>;
  response_metadata?: { next_cursor?: string };
};

type SlackInfoResponse = {
  ok: boolean;
  error?: string;
  channel?: {
    id: string;
    name: string;
    is_private?: boolean;
    is_member?: boolean;
    is_archived?: boolean;
  };
};

function token(): string {
  return env.SLACK_BOT_TOKEN;
}

/**
 * 채널 검색 — 채널명(부분일치, 대소문자 무시) 또는 채널 ID 직접 조회.
 *
 * - 입력이 채널 ID 패턴이면 `conversations.info`로 1건 직접 해석
 *   (목록에 안 잡히는 비공개 채널도 ID로 연동 가능).
 * - 그 외에는 `conversations.list`를 페이지네이션(최대 5페이지/1000개)하며
 *   이름에 검색어를 포함하는 채널을 필터링.
 */
export async function searchSlackChannels(
  query: string,
  limit = 20,
): Promise<{ ok: boolean; items: SlackChannelLite[]; error?: string }> {
  const t = token();
  if (!t) {
    // 스코프/토큰 미설정 — 빈 목록 (UI에서 안내).
    return { ok: false, items: [], error: 'slack_not_configured' };
  }

  const q = query.trim();

  // 1) 채널 ID 직접 입력 → conversations.info 단건 조회
  if (looksLikeChannelId(q)) {
    const info = await getSlackChannelInfo(q);
    if (info) return { ok: true, items: [info] };
    return { ok: true, items: [] };
  }

  // 2) 채널명 검색 — list 페이지네이션 + 로컬 필터
  const needle = q.toLowerCase();
  const items: SlackChannelLite[] = [];
  let cursor = '';
  try {
    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({
        types: 'public_channel,private_channel',
        exclude_archived: 'true',
        limit: '200',
      });
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(
        `${SLACK_API}/conversations.list?${params.toString()}`,
        { headers: { authorization: `Bearer ${t}` }, cache: 'no-store' },
      );
      const data = (await res.json().catch(() => null)) as SlackListResponse | null;
      if (!data || !data.ok) {
        return { ok: false, items, error: data?.error ?? `http_${res.status}` };
      }
      for (const ch of data.channels ?? []) {
        if (ch.is_archived) continue;
        if (!needle || ch.name.toLowerCase().includes(needle)) {
          items.push({
            id: ch.id,
            name: ch.name,
            isPrivate: Boolean(ch.is_private),
            isMember: Boolean(ch.is_member),
            isArchived: Boolean(ch.is_archived),
          });
          if (items.length >= limit) return { ok: true, items };
        }
      }
      cursor = data.response_metadata?.next_cursor ?? '';
      if (!cursor) break;
    }
    return { ok: true, items };
  } catch (err) {
    return {
      ok: false,
      items,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}

/** 채널 ID → 채널 메타 (이름·공개여부·봇 멤버여부). 실패 시 null. */
export async function getSlackChannelInfo(
  channelId: string,
): Promise<SlackChannelLite | null> {
  const t = token();
  if (!t) return null;
  try {
    const res = await fetch(
      `${SLACK_API}/conversations.info?channel=${encodeURIComponent(channelId.trim())}`,
      { headers: { authorization: `Bearer ${t}` }, cache: 'no-store' },
    );
    const data = (await res.json().catch(() => null)) as SlackInfoResponse | null;
    if (!data || !data.ok || !data.channel) return null;
    const ch = data.channel;
    return {
      id: ch.id,
      name: ch.name,
      isPrivate: Boolean(ch.is_private),
      isMember: Boolean(ch.is_member),
      isArchived: Boolean(ch.is_archived),
    };
  } catch {
    return null;
  }
}

export type JoinResult = {
  /** 봇이 채널 멤버 상태인지 (이미 멤버였거나 입장 성공). */
  botJoined: boolean;
  /** 실패 사유 (있을 때). 비공개 채널은 보통 method_not_allowed_for_channel_type. */
  error?: string;
};

/**
 * 봇을 채널에 입장(`conversations.join`)시킨다 — 공개 채널만 가능.
 * 비공개 채널은 봇 self-join 불가 → 사람이 수동으로 `/invite @봇` 해야 함.
 */
export async function joinSlackChannel(channelId: string): Promise<JoinResult> {
  const t = token();
  if (!t) return { botJoined: false, error: 'slack_not_configured' };
  try {
    const res = await fetch(`${SLACK_API}/conversations.join`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        authorization: `Bearer ${t}`,
      },
      body: JSON.stringify({ channel: channelId.trim() }),
    });
    const data = (await res.json().catch(() => null)) as
      | { ok: boolean; error?: string }
      | null;
    if (data?.ok) return { botJoined: true };
    return { botJoined: false, error: data?.error ?? `http_${res.status}` };
  } catch (err) {
    return {
      botJoined: false,
      error: err instanceof Error ? err.message : 'unknown',
    };
  }
}
