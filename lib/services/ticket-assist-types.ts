/**
 * ai-reply-assist — 어시스트 공유 타입 (server-only 아님).
 *
 * 서버 서비스(ticket-assist.ts)와 클라이언트 컴포넌트(ai-assist/*)가 함께 쓰는 타입.
 * server-only 모듈을 클라이언트에서 import하지 않도록 타입만 여기로 분리한다.
 */

export type AssistDocType = 'article' | 'faq';

export type AssistDoc = {
  type: AssistDocType;
  id: string;
  title: string;
  url: string;
  snippet: string;
  /** 코사인 유사도 0~1. */
  score: number;
};

export type AssistTicket = {
  id: string;
  ticketNo: string;
  title: string;
  status: string;
  resolutionSnippet: string;
  url: string;
  score: number;
};

export type TicketAssist = { docs: AssistDoc[]; tickets: AssistTicket[] };

/** 모달/초안 버튼에 전달되는 모델 표시 정보 (직렬화 안전 — Date 제외). */
export type AssistModel = {
  id: string;
  provider: 'anthropic' | 'openai';
  code: string;
  label: string;
  description: string | null;
  tier: 'economy' | 'balanced' | 'premium';
  isDefault: boolean;
};

/** 초안 출처 칩 — 클라이언트가 선택 문서/티켓에서 구성. */
export type Citation = {
  type: 'article' | 'faq' | 'ticket';
  id: string;
  title: string;
  url: string;
};
