/**
 * 시안 공지 데이터 — 목록(landing-notices-view)·상세(/landing/notices/[id]) 공용.
 */

export type NoticeType = '공지사항' | '서비스 장애' | '릴리즈';

export const NOTICE_BADGE: Record<NoticeType, string> = {
  공지사항: 'bg-[#EFF6FF] text-[#217CF9]',
  '서비스 장애': 'bg-[#FEF2F2] text-[#FA342C]',
  릴리즈: 'bg-[#F4F1FE] text-[#7C3AED]',
};

export type LandingNotice = {
  id: number;
  type: NoticeType;
  title: string;
  date: string;
  body: string[];
};

export const LANDING_NOTICES: LandingNotice[] = [
  {
    id: 1,
    type: '공지사항',
    title: '2026년 6월 3일 지방선거일 휴무 안내',
    date: '2026-01-03',
    body: [
      '안녕하세요, OA서포트입니다.',
      '2026년 6월 3일(화) 제9회 전국동시지방선거일은 법정 공휴일로, 고객센터 및 기술지원이 휴무입니다.',
      '· 휴무일: 2026년 6월 3일(화)',
      '· 정상 운영: 2026년 6월 4일(수) 10:00부터',
      '휴무일에도 야간/휴일 긴급 장애 신고(070-8028-0919)는 운영되며, 단순 금액 정정 등은 정상 운영일에 처리됩니다. 이용에 참고 부탁드립니다.',
    ],
  },
  {
    id: 2,
    type: '서비스 장애',
    title: '아고다 장애 관련 안내',
    date: '2026-01-03',
    body: [
      '아고다(Agoda) 측 연동 지연으로 일부 예약 동기화가 늦어지는 현상이 있었습니다.',
      '· 영향: 아고다 신규 예약의 PMS 반영 지연(최대 15분)',
      '· 현재 상태: 복구 완료, 정상 동기화 중',
      '동기화 누락이 의심되는 예약은 예약조회에서 새로고침 후에도 보이지 않으면 고객센터로 문의해 주세요.',
    ],
  },
  {
    id: 3,
    type: '릴리즈',
    title: 'v1.1.0 릴리즈 노트 — 이슈 클레임 UX 개선',
    date: '2026-01-03',
    body: [
      'v1.1.0 업데이트가 적용되었습니다. 주요 변경 사항은 다음과 같습니다.',
      '· 문의 접수 화면 단계 간소화 및 첨부 미리보기 추가',
      '· 문의 상세에 진행 상태 스테퍼 도입(접수→처리중→완료)',
      '· 제품별 가이드 검색 정확도 개선',
      '자세한 내용은 각 화면의 도움말을 참고해 주세요.',
    ],
  },
];

export function getLandingNotice(id: number): LandingNotice | undefined {
  // 시안: 등록된 3종을 순환 매핑 (목록의 반복 항목도 상세가 열리도록)
  if (LANDING_NOTICES.some((n) => n.id === id)) {
    return LANDING_NOTICES.find((n) => n.id === id);
  }
  const idx = ((id - 1) % LANDING_NOTICES.length + LANDING_NOTICES.length) %
    LANDING_NOTICES.length;
  const base = LANDING_NOTICES[idx];
  return base ? { ...base, id } : undefined;
}
