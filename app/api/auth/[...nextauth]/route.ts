/**
 * NextAuth v5 핸들러.
 * /api/auth/signin, /api/auth/callback/*, /api/auth/session 등을 처리.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // bcryptjs는 nodejs runtime 권장 (edge에서도 동작하지만 성능 측면)

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
