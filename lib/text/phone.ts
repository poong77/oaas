/**
 * 한국 전화번호 표기 정규화.
 *
 * 입력 형식이 제각각인 연락처를 `0XX-XXX(X)-XXXX` 하이픈 표기로 통일한다.
 *   - 휴대폰(010 등)·서울(02)·지역(0XX)·대표번호(15XX/16XX/18XX) 지원
 *   - 국제번호(+...)는 숫자/＋만 남겨 그대로 보존
 *   - 이메일 등 전화번호가 아닌 값, 더미(0000), 8자리 미만 → null
 *   - 뒤 주석("(업무폰)") · 범위("~3")는 제거하고 대표번호만 취함
 *
 * @example
 *   normalizeKoreanPhone('01091488046')      // '010-9148-8046'
 *   normalizeKoreanPhone('02 754 8124')      // '02-754-8124'
 *   normalizeKoreanPhone('031. 857. 5557')   // '031-857-5557'
 *   normalizeKoreanPhone('(064)7330888')     // '064-733-0888'
 *   normalizeKoreanPhone('1670-0665')        // '1670-0665'
 *   normalizeKoreanPhone('kwj@blueone.com')  // null
 *   normalizeKoreanPhone('+84778900817')     // '+84778900817'
 */
export function normalizeKoreanPhone(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s) return null;

  // 국제번호: 숫자와 + 만 남겨 보존 (한국 자릿수 규칙 적용 불가)
  if (s.startsWith('+')) {
    const intl = s.replace(/[^\d+]/g, '');
    return intl.length > 1 ? intl : null;
  }

  // 영문/@ 포함 → 전화번호 아님 (이메일 오입력 등)
  if (/[a-zA-Z@]/.test(s)) return null;

  // 범위 표기("533-7782~3")는 시작 번호만 취함
  const head = s.replace(/~.*$/, '');
  const digits = head.replace(/\D/g, '');
  // 빈값·더미(전부 0)·길이 부족 → 전화번호 아님
  if (!digits || /^0+$/.test(digits) || digits.length < 8) return null;

  // 한국 표준 패턴이 아니면 억지로 변환하지 않고 원본을 보존
  return splitKoreanDigits(digits) ?? s;
}

/** 숫자열을 한국 번호 체계에 맞춰 하이픈으로 분할. 패턴 불명 시 null. */
function splitKoreanDigits(digits: string): string | null {
  // 서울 02
  if (digits.startsWith('02')) {
    return `02-${groupSubscriber(digits.slice(2))}`;
  }
  // 050X 평생번호 (0507-XXXX-XXXX): 4자리 prefix
  if (digits.startsWith('050')) {
    return `${digits.slice(0, 4)}-${groupSubscriber(digits.slice(4))}`;
  }
  // 대표번호 8자리 (15XX/16XX/18XX-XXXX 등 1로 시작)
  if (digits.length === 8 && digits[0] === '1') {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  // 휴대폰(010 등)·지역(0XX)·인터넷전화(070): 0으로 시작하는 3자리 국번
  if (digits[0] === '0') {
    return `${digits.slice(0, 3)}-${groupSubscriber(digits.slice(3))}`;
  }
  // 그 외(앞 0 누락 등 비표준) → 변환 보류
  return null;
}

/** 국번을 뺀 가입자 번호를 3-4 또는 4-4로 분할. */
function groupSubscriber(rest: string): string {
  if (rest.length === 8) return `${rest.slice(0, 4)}-${rest.slice(4)}`;
  if (rest.length === 7) return `${rest.slice(0, 3)}-${rest.slice(3)}`;
  // 규칙 외 길이는 그대로 (분할 강제하지 않음)
  return rest;
}
