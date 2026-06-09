/**
 * 알림 템플릿 — Phase 1 ~ Phase 5 하드코딩 + Phase 9 DB wrapper.
 *
 * Phase 9 통합:
 *   - 기존 `buildXxx(vars)` 빌더 함수는 그대로 유지 (HTML 본문 복잡도 분리).
 *   - DB의 `notification_templates`에 row가 있으면 subject/text/sms를 덮어쓰는
 *     `applyDbOverride(eventKey, channel, baseResult, vars)` 헬퍼 제공.
 *   - 호출부는 await로 wrapper를 한 번 더 거치면 어드민 편집 본문이 반영됨.
 *   - DB row 없거나 조회 실패 → 빌더 결과 그대로 사용 (graceful fallback).
 */

import { findTemplate, renderTemplateBody } from '@/lib/services/master-templates';
import type { NotificationChannel } from '@/db/schema';

export type AccountInviteVars = {
  name: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
  invitedByName?: string;
};

export type PasswordResetVars = {
  name: string;
  tempPassword: string;
  loginUrl: string;
};

/** AC-11: 셀프 비밀번호 찾기 — 이메일 재설정 링크. */
export type PasswordResetLinkVars = {
  name: string;
  resetUrl: string;
  expiresMinutes: number;
};

/** AC-11: 셀프 비밀번호 찾기 — 문자 인증코드. */
export type PasswordResetCodeVars = {
  name: string;
  code: string;
  expiresMinutes: number;
};

/** AC-11: 비밀번호 변경 완료 알림. */
export type PasswordChangedVars = {
  name: string;
};

/** Phase 5: 신규 티켓 접수확인 (호텔리어 대상). */
export type TicketReceivedVars = {
  reporterName: string;
  ticketNo: string;
  title: string;
  productLabel: string;
  issueTypeLabel: string;
  urgencyLabel: string;
  ticketUrl: string;
};

/** Phase 5/6: 상태 전환 알림 (호텔리어 대상). */
export type TicketStatusChangedVars = {
  reporterName: string;
  ticketNo: string;
  title: string;
  fromLabel: string;
  toLabel: string;
  ticketUrl: string;
  managerName?: string | null;
};

const BRAND = 'OA 통합 AS';

function htmlWrap(title: string, body: string) {
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;background:#f8fafc;padding:24px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
    <h1 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${title}</h1>
    ${body}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
    <p style="font-size:12px;color:#64748b;margin:0;">본 메일은 ${BRAND} 시스템에서 자동 발송되었습니다.</p>
  </div></body></html>`;
}

export function buildAccountInvite(vars: AccountInviteVars) {
  const subject = `[${BRAND}] ${vars.name}님, 계정이 생성되었습니다`;
  const html = htmlWrap(
    `${vars.name}님, 환영합니다`,
    `
    <p style="font-size:14px;color:#334155;line-height:1.7;">
      ${vars.invitedByName ? `<strong>${vars.invitedByName}</strong>님이 회원님을 초대했습니다.` : '계정이 생성되었습니다.'}
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px;background:#f1f5f9;width:120px;">이메일</td><td style="padding:8px;border:1px solid #e2e8f0;">${vars.email}</td></tr>
      <tr><td style="padding:8px;background:#f1f5f9;">임시 비밀번호</td><td style="padding:8px;border:1px solid #e2e8f0;"><code style="background:#fef3c7;padding:2px 6px;border-radius:4px;">${vars.tempPassword}</code></td></tr>
    </table>
    <p style="font-size:13px;color:#64748b;">첫 로그인 시 비밀번호를 변경해주세요.</p>
    <p style="margin:24px 0 0;">
      <a href="${vars.loginUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">로그인 페이지로 이동</a>
    </p>
  `,
  );
  const text = `${vars.name}님, ${BRAND}에 초대되었습니다.\n이메일: ${vars.email}\n임시 비밀번호: ${vars.tempPassword}\n로그인: ${vars.loginUrl}\n첫 로그인 후 비밀번호를 변경해주세요.`;
  const sms = `[${BRAND}] ${vars.name}님 계정이 생성됐어요. 임시비번: ${vars.tempPassword} (첫 로그인 후 변경 필요) ${vars.loginUrl}`;
  return { subject, html, text, sms };
}

export function buildPasswordReset(vars: PasswordResetVars) {
  const subject = `[${BRAND}] 비밀번호가 초기화되었습니다`;
  const html = htmlWrap(
    '비밀번호 초기화 안내',
    `
    <p style="font-size:14px;color:#334155;line-height:1.7;">
      ${vars.name}님, 관리자에 의해 비밀번호가 초기화되었습니다.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px;background:#f1f5f9;width:120px;">임시 비밀번호</td><td style="padding:8px;border:1px solid #e2e8f0;"><code style="background:#fef3c7;padding:2px 6px;border-radius:4px;">${vars.tempPassword}</code></td></tr>
    </table>
    <p style="font-size:13px;color:#b91c1c;">보안을 위해 로그인 후 즉시 비밀번호를 변경해주세요.</p>
    <p style="margin:24px 0 0;">
      <a href="${vars.loginUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">로그인 페이지로 이동</a>
    </p>
  `,
  );
  const text = `${vars.name}님 비밀번호가 초기화됐습니다.\n임시 비밀번호: ${vars.tempPassword}\n로그인: ${vars.loginUrl}\n로그인 후 즉시 변경해주세요.`;
  const sms = `[${BRAND}] 비밀번호가 초기화됐어요. 임시비번: ${vars.tempPassword} 로그인 후 즉시 변경 ${vars.loginUrl}`;
  return { subject, html, text, sms };
}

// ─────────────────────────────────────────────────────────────────────
// AC-11 — 셀프 비밀번호 찾기 (OTP/토큰 방식)
// ─────────────────────────────────────────────────────────────────────

export function buildPasswordResetLink(vars: PasswordResetLinkVars) {
  const subject = `[${BRAND}] 비밀번호 재설정 안내`;
  const html = htmlWrap(
    '비밀번호 재설정',
    `
    <p style="font-size:14px;color:#334155;line-height:1.7;">
      ${vars.name}님, 비밀번호 재설정을 요청하셨습니다.<br/>
      아래 버튼을 눌러 ${vars.expiresMinutes}분 이내에 새 비밀번호를 설정해주세요.
    </p>
    <p style="margin:24px 0;">
      <a href="${vars.resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">새 비밀번호 설정하기</a>
    </p>
    <p style="font-size:12px;color:#64748b;line-height:1.6;">
      버튼이 동작하지 않으면 아래 링크를 복사해 브라우저에 붙여넣으세요.<br/>
      <span style="word-break:break-all;color:#475569;">${vars.resetUrl}</span>
    </p>
    <p style="font-size:13px;color:#b91c1c;margin-top:16px;">
      본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다. 비밀번호는 변경되지 않습니다.
    </p>
  `,
  );
  const text = `${vars.name}님, ${BRAND} 비밀번호 재설정 링크입니다.\n${vars.expiresMinutes}분 이내에 접속해 새 비밀번호를 설정해주세요.\n${vars.resetUrl}\n\n본인이 요청하지 않았다면 무시하세요.`;
  const sms = `[${BRAND}] 비밀번호 재설정 링크: ${vars.resetUrl} (${vars.expiresMinutes}분 유효)`;
  return { subject, html, text, sms };
}

export function buildPasswordResetCode(vars: PasswordResetCodeVars) {
  const subject = `[${BRAND}] 비밀번호 재설정 인증코드`;
  const html = htmlWrap(
    '인증코드 안내',
    `
    <p style="font-size:14px;color:#334155;line-height:1.7;">${vars.name}님, 아래 인증코드를 입력해주세요.</p>
    <p style="margin:20px 0;text-align:center;">
      <span style="display:inline-block;font-size:28px;letter-spacing:8px;font-weight:700;color:#4338ca;background:#eef2ff;padding:12px 20px;border-radius:10px;">${vars.code}</span>
    </p>
    <p style="font-size:13px;color:#64748b;">${vars.expiresMinutes}분 이내에 입력해주세요. 코드는 1회만 사용할 수 있습니다.</p>
  `,
  );
  const text = `${vars.name}님, ${BRAND} 인증코드: ${vars.code} (${vars.expiresMinutes}분 유효)`;
  const sms = `[${BRAND}] 비밀번호 재설정 인증코드: ${vars.code}\n${vars.expiresMinutes}분 이내 입력. 타인에게 알려주지 마세요.`;
  return { subject, html, text, sms };
}

export function buildPasswordChanged(vars: PasswordChangedVars) {
  const subject = `[${BRAND}] 비밀번호가 변경되었습니다`;
  const html = htmlWrap(
    '비밀번호 변경 완료',
    `
    <p style="font-size:14px;color:#334155;line-height:1.7;">
      ${vars.name}님, 비밀번호가 정상적으로 변경되었습니다.
    </p>
    <p style="font-size:13px;color:#b91c1c;margin-top:12px;">
      본인이 변경한 것이 아니라면 즉시 관리자에게 문의해주세요.
    </p>
  `,
  );
  const text = `${vars.name}님, ${BRAND} 비밀번호가 변경되었습니다.\n본인이 변경한 것이 아니라면 즉시 관리자에게 문의해주세요.`;
  const sms = `[${BRAND}] 비밀번호가 변경되었습니다. 본인이 아니라면 즉시 관리자에게 문의하세요.`;
  return { subject, html, text, sms };
}

// ─────────────────────────────────────────────────────────────────────
// Phase 5 — 티켓 이벤트
// ─────────────────────────────────────────────────────────────────────

export function buildTicketReceived(vars: TicketReceivedVars) {
  const subject = `[${BRAND}] 접수 완료 — ${vars.ticketNo}`;
  const html = htmlWrap(
    '문의가 정상 접수되었습니다',
    `
    <p style="font-size:14px;color:#334155;line-height:1.7;">
      ${vars.reporterName}님, 문의가 접수되었습니다. 운영팀이 빠르게 확인 후 답변드리겠습니다.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px;background:#f1f5f9;width:120px;">티켓 번호</td><td style="padding:8px;border:1px solid #e2e8f0;"><code style="background:#eef2ff;padding:2px 8px;border-radius:4px;color:#4338ca;">${vars.ticketNo}</code></td></tr>
      <tr><td style="padding:8px;background:#f1f5f9;">제목</td><td style="padding:8px;border:1px solid #e2e8f0;">${vars.title}</td></tr>
      <tr><td style="padding:8px;background:#f1f5f9;">제품 / 유형</td><td style="padding:8px;border:1px solid #e2e8f0;">${vars.productLabel} · ${vars.issueTypeLabel}</td></tr>
      <tr><td style="padding:8px;background:#f1f5f9;">긴급도</td><td style="padding:8px;border:1px solid #e2e8f0;">${vars.urgencyLabel}</td></tr>
    </table>
    <p style="font-size:13px;color:#64748b;">처리 진행 상황은 아래 링크에서 실시간으로 확인 가능합니다.</p>
    <p style="margin:24px 0 0;">
      <a href="${vars.ticketUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">티켓 보기</a>
    </p>
  `,
  );
  const text = [
    `${vars.reporterName}님, ${BRAND} 문의가 접수되었습니다.`,
    `티켓번호: ${vars.ticketNo}`,
    `제목: ${vars.title}`,
    `제품·유형: ${vars.productLabel} · ${vars.issueTypeLabel}`,
    `긴급도: ${vars.urgencyLabel}`,
    `진행상황: ${vars.ticketUrl}`,
  ].join('\n');
  const sms = `[${BRAND}] 접수 완료. 티켓 ${vars.ticketNo}. ${truncate(vars.title, 24)} ${vars.ticketUrl}`;
  return { subject, html, text, sms };
}

export function buildTicketInProgress(vars: TicketStatusChangedVars) {
  const subject = `[${BRAND}] 처리중 — ${vars.ticketNo}`;
  const managerLine = vars.managerName
    ? `<p style="font-size:13px;color:#64748b;">담당자: ${vars.managerName}</p>`
    : '';
  const html = htmlWrap(
    '문의가 처리 중입니다',
    `
    <p style="font-size:14px;color:#334155;line-height:1.7;">
      ${vars.reporterName}님, <strong>${vars.ticketNo}</strong> 티켓이 처리 단계로 전환되었습니다.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px;background:#f1f5f9;width:120px;">제목</td><td style="padding:8px;border:1px solid #e2e8f0;">${vars.title}</td></tr>
      <tr><td style="padding:8px;background:#f1f5f9;">상태</td><td style="padding:8px;border:1px solid #e2e8f0;">${vars.fromLabel} → <strong>${vars.toLabel}</strong></td></tr>
    </table>
    ${managerLine}
    <p style="margin:24px 0 0;">
      <a href="${vars.ticketUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">진행상황 보기</a>
    </p>
  `,
  );
  const text = `${vars.reporterName}님, 티켓 ${vars.ticketNo} 상태가 ${vars.fromLabel}→${vars.toLabel}로 전환되었습니다.\n${vars.ticketUrl}`;
  const sms = `[${BRAND}] ${vars.ticketNo} 처리중. ${truncate(vars.title, 20)} ${vars.ticketUrl}`;
  return { subject, html, text, sms };
}

export function buildTicketCompleted(vars: TicketStatusChangedVars) {
  const subject = `[${BRAND}] 처리 완료 — ${vars.ticketNo}`;
  const managerLine = vars.managerName
    ? `<p style="font-size:13px;color:#64748b;">담당자: ${vars.managerName}</p>`
    : '';
  const html = htmlWrap(
    '문의가 완료되었습니다',
    `
    <p style="font-size:14px;color:#334155;line-height:1.7;">
      ${vars.reporterName}님, <strong>${vars.ticketNo}</strong> 티켓이 완료 처리되었습니다.
      처리 내용을 확인하시고, 추가 문의가 있으시면 답변 작성 또는 신규 접수 부탁드립니다.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:8px;background:#f1f5f9;width:120px;">제목</td><td style="padding:8px;border:1px solid #e2e8f0;">${vars.title}</td></tr>
      <tr><td style="padding:8px;background:#f1f5f9;">상태</td><td style="padding:8px;border:1px solid #e2e8f0;">${vars.fromLabel} → <strong style="color:#15803d;">${vars.toLabel}</strong></td></tr>
    </table>
    ${managerLine}
    <p style="margin:24px 0 0;">
      <a href="${vars.ticketUrl}" style="display:inline-block;background:#15803d;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">처리 결과 보기</a>
    </p>
  `,
  );
  const text = `${vars.reporterName}님, 티켓 ${vars.ticketNo}이(가) 완료되었습니다.\n${vars.ticketUrl}`;
  const sms = `[${BRAND}] ${vars.ticketNo} 처리 완료. ${truncate(vars.title, 20)} ${vars.ticketUrl}`;
  return { subject, html, text, sms };
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

// ─────────────────────────────────────────────────────────────────────
// Phase 9 — DB override wrapper
// ─────────────────────────────────────────────────────────────────────

export type BuilderResult = {
  subject: string;
  html: string;
  text: string;
  sms: string;
};

/**
 * DB의 notification_templates를 lookup해서 채널별 본문을 덮어쓴다.
 *
 * - channel === 'email'이면 subject + bodyTemplate(text 본문) 덮어씀. html은 그대로 유지.
 * - channel === 'sms'이면 sms 텍스트 본문만 덮어씀.
 * - DB row 없거나 빈 본문이면 base 그대로 반환.
 *
 * @param eventKey 'ticket.received' 등
 * @param vars renderTemplateBody용 변수 맵
 * @param base buildXxx() 결과
 */
export async function applyDbOverride(
  eventKey: string,
  vars: Record<string, string | number | null | undefined>,
  base: BuilderResult,
): Promise<BuilderResult> {
  try {
    const [emailRow, smsRow] = await Promise.all([
      findTemplate('email' as NotificationChannel, eventKey),
      findTemplate('sms' as NotificationChannel, eventKey),
    ]);

    let { subject, html, text, sms } = base;
    if (emailRow) {
      if (emailRow.subject) subject = renderTemplateBody(emailRow.subject, vars);
      if (emailRow.bodyTemplate)
        text = renderTemplateBody(emailRow.bodyTemplate, vars);
    }
    if (smsRow?.bodyTemplate) {
      sms = renderTemplateBody(smsRow.bodyTemplate, vars);
    }
    return { subject, html, text, sms };
  } catch (err) {
    console.warn('[templates.applyDbOverride] DB lookup 실패, fallback 사용:', err);
    return base;
  }
}
