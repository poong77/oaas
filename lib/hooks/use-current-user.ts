'use client';

/**
 * 클라이언트 컴포넌트용 현재 사용자 hook.
 * NextAuth v5 useSession 래퍼.
 */

import { useSession } from 'next-auth/react';
import type { UserRole } from '@/db/schema';

export function useCurrentUser() {
  const { data, status, update } = useSession();
  return {
    user: data?.user
      ? {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role as UserRole,
          hotelId: data.user.hotelId,
          mustChangePassword: data.user.mustChangePassword,
        }
      : null,
    status, // 'loading' | 'authenticated' | 'unauthenticated'
    update, // session 강제 새로고침 (role 변경 후 등)
  };
}
