/**
 * E2E 테스트용 시드 계정 fixture.
 *
 * 비밀번호는 db/seed.ts와 동일 (개발 환경 dev stub 인증).
 * 프로덕션에서는 절대 사용되지 않는다 (AUTH_DEV_STUB=true일 때만 활성).
 */
export const TEST_USERS = {
  admin: {
    email: 'admin@oa.local',
    password: 'oa1234!',
    role: 'admin' as const,
    label: '어드민',
  },
  manager: {
    email: 'manager@oa.local',
    password: 'oa1234!',
    role: 'manager' as const,
    label: '매니저',
  },
  hotelier: {
    email: 'hotelier@oa.local',
    password: 'oa1234!',
    role: 'hotelier' as const,
    label: '호텔리어',
  },
} as const;

export type TestUserKey = keyof typeof TEST_USERS;

/** storageState 파일 경로 (전역 setup이 저장) */
export const STORAGE_STATE_PATHS: Record<TestUserKey, string> = {
  admin: 'e2e/.auth/admin.json',
  manager: 'e2e/.auth/manager.json',
  hotelier: 'e2e/.auth/hotelier.json',
};
