/**
 * 알림 템플릿 — Phase 1 ~ Phase 5 하드코딩.
 *
 * TODO(phase-1-temp): Phase 9에서 `notification_templates` DB로 옮겨 어드민 편집 가능하게.
 * 현재는 이벤트별 함수로 분리해두면 향후 DB 치환 시 호출부 변경 최소화.
 */

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
