/**
 * 운영 상태 계산 — 순수 함수 (DB 의존 없음).
 *
 * 호텔리어 컨택 패널(BusinessStatusBadge)과 관리자 미리보기 양쪽에서 공유한다.
 * 입력: 현재 시각(UTC Date) + 운영시간 정책(BusinessHoursInput) + 공휴일 리스트.
 * 출력: 상태(open/lunch/intake_closed/closed) + 부가 정보 (남은 시간·다음 영업 시각).
 *
 * Timezone은 항상 정책의 `timezone`(기본 'Asia/Seoul') 기준으로 비교한다.
 * native Date를 KST 벽시계 시각으로 정확히 매핑하기 위해 sv-SE 로케일을 사용 —
 * sv-SE는 'YYYY-MM-DD HH:MM:SS' ISO 형식으로 출력되어 파싱이 안정적이다.
 *
 * P2에서 `business_hours_overrides`가 추가되면 calculateBusinessStatus 호출 전에
 * `effective hours`를 override로 치환하는 헬퍼를 별도 추가한다 (시그니처는 그대로).
 */

export type BusinessHoursInput = {
  /** 'HH:MM' or 'HH:MM:SS' — PostgreSQL time 컬럼 raw 문자열 그대로 받음 */
  weekdayOpen: string;
  weekdayClose: string;
  lunchStart: string | null;
  lunchEnd: string | null;
  intakeDeadline: string | null;
  saturdayClosed: boolean;
  sundayClosed: boolean;
  holidaysClosed: boolean;
  emergencyPhone: string | null;
  emergencyNote: string | null;
  /** IANA timezone, 기본 'Asia/Seoul' */
  timezone: string;
  /**
   * P2: active override (kind='closed')가 있으면 즉시 휴무 처리.
   * service layer에서 채워서 calculate에 전달한다 (calculate는 override 자체를 모름).
   */
  forcedClosure?: {
    /** 사용자 표시 라벨 — "단축 휴무 (4/30~5/2)" / "임시휴무 — 사옥 점검" 등 */
    label: string;
    reason: string;
  } | null;
};

export type HolidayInfo = {
  /** 'YYYY-MM-DD' */
  date: string;
  name: string;
  /** true면 매년 반복 (현재는 UI 표기용 — 자동 적용 로직은 P2) */
  isRecurring: boolean;
};

export type BusinessStatus =
  | 'open' // 영업 중 (접수 가능)
  | 'lunch' // 점심시간 (영업 중이지만 응대 지연)
  | 'intake_closed' // 영업 중이지만 당일 접수 마감 (예: 18:00~18:40)
  | 'closed'; // 영업 외

export type ClosedReason =
  | 'before_open' // 오픈 전
  | 'after_close' // 클로즈 후
  | 'weekend' // 주말
  | 'holiday' // 공휴일
  | null;

export type BusinessStatusResult = {
  status: BusinessStatus;
  closedReason: ClosedReason;
  /** 사용자 표시 라벨 — "영업 중", "점심시간", "영업 종료", "공휴일 휴무" 등 */
  label: string;
  /** 영업 종료까지 남은 ms (status='open' | 'intake_closed' | 'lunch'일 때만) */
  msUntilClose: number | null;
  /** 접수 마감까지 남은 ms (status='open'이고 intake_deadline이 설정된 경우만) */
  msUntilIntakeClose: number | null;
  /** 다음 영업 시작 시각 — status='closed' | 'lunch'일 때 */
  nextOpenAt: Date | null;
  /** 오늘이 공휴일이면 이름 (휴무 처리 여부와 무관하게 정보 제공) */
  todayHolidayName: string | null;
  emergencyPhone: string | null;
  emergencyNote: string | null;
  /** 디버그용 — 정책 기준으로 계산된 effective 시각 */
  debug: {
    localDate: string; // 'YYYY-MM-DD' KST
    localTime: string; // 'HH:MM' KST
    weekday: number; // 0=일요일 ~ 6=토요일
  };
};

// ─────────────────────────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────────────────────────

export function calculateBusinessStatus(args: {
  now: Date;
  hours: BusinessHoursInput;
  holidays: HolidayInfo[];
}): BusinessStatusResult {
  const { now, hours, holidays } = args;
  const { localDate, localTime, weekday } = extractLocalParts(
    now,
    hours.timezone,
  );

  // 오늘 공휴일 매칭 (양력 매년 반복 + 음력/대체 정확한 날짜)
  const todayHoliday = findHolidayForDate(localDate, holidays);
  const todayHolidayName = todayHoliday?.name ?? null;

  // P2: active override (kind='closed') 우선 적용
  if (hours.forcedClosure) {
    return makeClosedResult({
      reason: 'holiday', // 표시 분류는 holiday와 동일 (임시휴무도 휴무)
      label: hours.forcedClosure.label,
      nextOpenAt: findNextOpenDate(now, hours, holidays),
      hours,
      todayHolidayName,
      debug: { localDate, localTime, weekday },
    });
  }

  // 휴무 조건 우선순위: 공휴일 > 주말 > 시간 외
  if (hours.holidaysClosed && todayHoliday) {
    return makeClosedResult({
      reason: 'holiday',
      label: `${todayHoliday.name} 휴무`,
      nextOpenAt: findNextOpenDate(now, hours, holidays),
      hours,
      todayHolidayName,
      debug: { localDate, localTime, weekday },
    });
  }

  if (weekday === 0 && hours.sundayClosed) {
    return makeClosedResult({
      reason: 'weekend',
      label: '일요일 휴무',
      nextOpenAt: findNextOpenDate(now, hours, holidays),
      hours,
      todayHolidayName,
      debug: { localDate, localTime, weekday },
    });
  }
  if (weekday === 6 && hours.saturdayClosed) {
    return makeClosedResult({
      reason: 'weekend',
      label: '토요일 휴무',
      nextOpenAt: findNextOpenDate(now, hours, holidays),
      hours,
      todayHolidayName,
      debug: { localDate, localTime, weekday },
    });
  }

  // 시간 비교 (분 단위)
  const nowMin = timeToMinutes(localTime);
  const openMin = timeToMinutes(hours.weekdayOpen);
  const closeMin = timeToMinutes(hours.weekdayClose);
  const lunchStartMin = hours.lunchStart
    ? timeToMinutes(hours.lunchStart)
    : null;
  const lunchEndMin = hours.lunchEnd ? timeToMinutes(hours.lunchEnd) : null;
  const intakeMin = hours.intakeDeadline
    ? timeToMinutes(hours.intakeDeadline)
    : null;

  // 오픈 전
  if (nowMin < openMin) {
    return makeClosedResult({
      reason: 'before_open',
      label: '영업 시작 전',
      nextOpenAt: combineLocalDateTime(localDate, hours.weekdayOpen, hours.timezone),
      hours,
      todayHolidayName,
      debug: { localDate, localTime, weekday },
    });
  }

  // 클로즈 후
  if (nowMin >= closeMin) {
    return makeClosedResult({
      reason: 'after_close',
      label: '영업 종료',
      nextOpenAt: findNextOpenDate(now, hours, holidays),
      hours,
      todayHolidayName,
      debug: { localDate, localTime, weekday },
    });
  }

  // 점심시간
  if (
    lunchStartMin !== null &&
    lunchEndMin !== null &&
    nowMin >= lunchStartMin &&
    nowMin < lunchEndMin
  ) {
    return {
      status: 'lunch',
      closedReason: null,
      label: '점심시간',
      msUntilClose: (closeMin - nowMin) * 60_000,
      msUntilIntakeClose: null,
      nextOpenAt: combineLocalDateTime(
        localDate,
        hours.lunchEnd!,
        hours.timezone,
      ),
      todayHolidayName,
      emergencyPhone: hours.emergencyPhone,
      emergencyNote: hours.emergencyNote,
      debug: { localDate, localTime, weekday },
    };
  }

  // 접수 마감 후 ~ 영업 종료 전
  if (intakeMin !== null && nowMin >= intakeMin) {
    return {
      status: 'intake_closed',
      closedReason: null,
      label: '접수 마감 (영업 중)',
      msUntilClose: (closeMin - nowMin) * 60_000,
      msUntilIntakeClose: null,
      nextOpenAt: null,
      todayHolidayName,
      emergencyPhone: hours.emergencyPhone,
      emergencyNote: hours.emergencyNote,
      debug: { localDate, localTime, weekday },
    };
  }

  // 영업 중 + 접수 가능
  return {
    status: 'open',
    closedReason: null,
    label: '영업 중',
    msUntilClose: (closeMin - nowMin) * 60_000,
    msUntilIntakeClose:
      intakeMin !== null ? (intakeMin - nowMin) * 60_000 : null,
    nextOpenAt: null,
    todayHolidayName,
    emergencyPhone: hours.emergencyPhone,
    emergencyNote: hours.emergencyNote,
    debug: { localDate, localTime, weekday },
  };
}

// ─────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────

function makeClosedResult(args: {
  reason: ClosedReason;
  label: string;
  nextOpenAt: Date | null;
  hours: BusinessHoursInput;
  todayHolidayName: string | null;
  debug: BusinessStatusResult['debug'];
}): BusinessStatusResult {
  return {
    status: 'closed',
    closedReason: args.reason,
    label: args.label,
    msUntilClose: null,
    msUntilIntakeClose: null,
    nextOpenAt: args.nextOpenAt,
    todayHolidayName: args.todayHolidayName,
    emergencyPhone: args.hours.emergencyPhone,
    emergencyNote: args.hours.emergencyNote,
    debug: args.debug,
  };
}

/** 'HH:MM' or 'HH:MM:SS' → 자정 이후 분(minute) */
function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(':');
  return Number(hh) * 60 + Number(mm);
}

/**
 * UTC Date를 정책 timezone의 'YYYY-MM-DD' / 'HH:MM' / 요일로 분해.
 * sv-SE 로케일은 ISO 형식으로 출력되어 파싱이 안전.
 */
function extractLocalParts(
  now: Date,
  timezone: string,
): { localDate: string; localTime: string; weekday: number } {
  // 'YYYY-MM-DD HH:MM:SS'
  const iso = now.toLocaleString('sv-SE', { timeZone: timezone });
  const [date, time] = iso.split(' ');
  const [y, m, d] = date!.split('-').map(Number);
  const [hh, mm] = time!.split(':').map(Number);

  // weekday 계산: KST 시각으로 UTC Date 만들어 getUTCDay() — 시차 무시하고 요일만
  const weekday = new Date(
    Date.UTC(y!, m! - 1, d!, hh!, mm!),
  ).getUTCDay();

  return {
    localDate: date!,
    localTime: `${String(hh!).padStart(2, '0')}:${String(mm!).padStart(2, '0')}`,
    weekday,
  };
}

/**
 * 'YYYY-MM-DD' 날짜 + 'HH:MM' 시각 + timezone → UTC Date.
 *
 * 단순화: timezone='Asia/Seoul' (UTC+9) 가정으로 처리. 다른 timezone은 P2.
 * (대부분의 한국 비즈니스가 KST 단일이라 충분. timezone 컬럼은 향후 확장용.)
 */
function combineLocalDateTime(
  localDate: string,
  localTime: string,
  timezone: string,
): Date {
  const [y, m, d] = localDate.split('-').map(Number);
  const [hh, mm] = localTime.split(':').map(Number);

  if (timezone === 'Asia/Seoul') {
    // KST = UTC+9. KST의 (y,m,d,hh,mm)을 UTC로 변환.
    return new Date(Date.UTC(y!, m! - 1, d!, hh! - 9, mm!));
  }

  // 그 외 timezone — Intl 기반 정밀 변환 (단순화: 일반 UTC로 취급)
  return new Date(Date.UTC(y!, m! - 1, d!, hh!, mm!));
}

/**
 * 'YYYY-MM-DD' 날짜에 해당하는 공휴일 찾기.
 * - 정확 매칭 우선 (음력·대체공휴일은 연도까지 일치해야 함)
 * - is_recurring=true는 월/일만 매칭하여 매년 자동 적용
 */
function findHolidayForDate(
  localDate: string,
  holidays: HolidayInfo[],
): HolidayInfo | null {
  const exact = holidays.find((h) => h.date === localDate);
  if (exact) return exact;

  // recurring 매칭 (월-일만)
  const monthDay = localDate.slice(5); // 'MM-DD'
  return (
    holidays.find((h) => h.isRecurring && h.date.slice(5) === monthDay) ?? null
  );
}

/**
 * 다음 영업 시작 시각 — 휴무일을 건너뛰며 최대 30일 lookahead.
 *
 * 단순화: 영업 시작 시각은 항상 weekdayOpen 사용 (월~금 동일 가정).
 */
function findNextOpenDate(
  now: Date,
  hours: BusinessHoursInput,
  holidays: HolidayInfo[],
): Date | null {
  const { localDate, localTime, weekday } = extractLocalParts(
    now,
    hours.timezone,
  );

  // 오늘 점심 후 또는 오픈 전이면 오늘 weekdayOpen / lunchEnd 반환 (점심 케이스는 이미 위에서 분기됨)
  // 여기는 "다음 영업일" 계산이므로 오늘 영업 끝났거나 휴무인 케이스만 진입.

  const [y, m, d] = localDate.split('-').map(Number);
  // 내일부터 30일까지 순회
  for (let offset = 1; offset <= 30; offset++) {
    const candidate = new Date(Date.UTC(y!, m! - 1, d! + offset));
    const candDate = candidate.toISOString().slice(0, 10); // YYYY-MM-DD UTC 기준
    const candWeekday = candidate.getUTCDay();

    if (hours.saturdayClosed && candWeekday === 6) continue;
    if (hours.sundayClosed && candWeekday === 0) continue;

    const candHoliday = findHolidayForDate(candDate, holidays);
    if (hours.holidaysClosed && candHoliday) continue;

    return combineLocalDateTime(candDate, hours.weekdayOpen, hours.timezone);
  }

  // 사용 안 되는 변수 silencer
  void localTime;
  void weekday;
  return null;
}
