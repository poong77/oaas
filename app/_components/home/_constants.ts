/**
 * 홈(LP-01) 임시 상수.
 *
 * 이관 현황:
 *   - POPULAR_KEYWORDS → popular_keywords 테이블 (SS-04, 완료) — 이제 fallback 전용.
 *       (어드민: /admin/master/popular-keywords · 서비스: master-popular-keywords.ts)
 *   - QUICK_ACTIONS → quick_actions 테이블 (Phase 9, 완료)
 *   - ROLE_STARTERS → role_starters 테이블 (Phase 9, 완료)
 *
 * 모두 어드민 마스터 메뉴에서 편집 가능. DB row 0건일 때만 아래 상수가 노출됨.
 */

import type { LucideIcon } from 'lucide-react';
import {
  BedDouble,
  BellRing,
  Briefcase,
  HelpCircle,
  KeyRound,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Users as UsersIcon,
  Wrench,
} from 'lucide-react';

export const POPULAR_KEYWORDS: string[] = [
  '체크인 오류',
  '결제 실패',
  '키 발급 안됨',
  '객실 동기화',
  '알림 미수신',
];

export type QuickActionItem = {
  label: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

export const QUICK_ACTIONS: QuickActionItem[] = [
  {
    label: '비밀번호 초기화',
    description: '로그인 비밀번호를 초기화합니다.',
    href: '/profile',
    icon: KeyRound,
  },
  {
    label: '솔루션 링크 변경',
    description: 'PMS·Keyless 등 솔루션 링크를 관리합니다.',
    href: '/profile',
    icon: Wrench,
  },
  {
    label: '직원 추가',
    description: '본인 숙소 직원 계정을 추가합니다.',
    href: '/profile/staff',
    icon: UsersIcon,
  },
  {
    label: '문의 접수',
    description: '오류·기능문의를 새 티켓으로 접수합니다.',
    href: '/tickets/new',
    icon: HelpCircle,
  },
  {
    label: '처리 상태 확인',
    description: '내가 접수한 문의의 처리 상태를 확인합니다.',
    href: '/tickets',
    icon: ListChecks,
  },
];

export type RoleStarter = {
  key: 'front' | 'sales' | 'housekeeping' | 'manager' | 'new_open';
  label: string;
  description: string;
  icon: LucideIcon;
};

export const ROLE_STARTERS: RoleStarter[] = [
  {
    key: 'front',
    label: '프론트',
    description: '체크인·체크아웃·키 발급 등 프론트 데스크 업무 가이드',
    icon: BellRing,
  },
  {
    key: 'sales',
    label: '예약·판매',
    description: '예약 등록·요금 관리·OTA 연동 가이드',
    icon: Briefcase,
  },
  {
    key: 'housekeeping',
    label: '하우스키핑',
    description: '객실 정리 상태·동기화·키오스크 가이드',
    icon: BedDouble,
  },
  {
    key: 'manager',
    label: '관리자',
    description: '직원·권한·매출 리포트 등 호텔 관리자 가이드',
    icon: ShieldCheck,
  },
  {
    key: 'new_open',
    label: '신규 오픈',
    description: '신규 호텔 오픈 셋업 체크리스트와 초기 설정',
    icon: Sparkles,
  },
];

export const HOME_CTAS = [
  {
    label: '일반 접수',
    description: '오류 외 기능문의 / 기능개발 / 데이터수정 / 기타',
    href: '/tickets/new',
    tone: 'primary',
  },
  {
    label: '오류 접수',
    description: '서비스에 발생한 오류·장애를 빠르게 접수합니다.',
    href: '/tickets/new?type=error',
    tone: 'danger',
  },
  {
    label: '내 문의',
    description: '내가 접수한 문의의 상태와 처리 내역을 확인합니다.',
    href: '/tickets',
    tone: 'secondary',
  },
] as const;
