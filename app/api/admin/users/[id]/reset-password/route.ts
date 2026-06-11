/**
 * AC-09: 어드민이 사용자 비밀번호를 초기화하는 API.
 *
 * Server Action(resetUserPasswordAdminAction)와 동일한 로직을 HTTP 엔드포인트로도 노출.
 * Programmatic 호출 (예: 운영 스크립트, cron) 용.
 */

import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { db } from '@/db';
import { users } from '@/db/schema';
import { getCurrentUser } from '@/lib/permissions';
import { logActivity } from '@/lib/audit';
import {
  generateTempPassword,
  hashPassword,
} from '@/lib/services/users';
import { sendEmail } from '@/lib/notifications/ses';
import { sendSms } from '@/lib/notifications/solapi';
import { buildPasswordReset } from '@/lib/notifications/templates';
import { getPublicBaseUrl } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }
  if (me.role !== 'admin') {
    return NextResponse.json(
      { ok: false, error: 'FORBIDDEN' },
      { status: 403 },
    );
  }
  if (!db) {
    return NextResponse.json(
      { ok: false, error: 'DB_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json(
      { ok: false, error: 'INVALID_ID' },
      { status: 400 },
    );
  }

  try {
    const rows = await db
      .select({
        email: users.email,
        phone: users.phone,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!rows[0]) {
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    await db
      .update(users)
      .set({ passwordHash, mustChangePassword: true })
      .where(eq(users.id, id));

    logActivity({
      userId: me.id,
      action: 'user.password_reset',
      targetType: 'user',
      targetId: id,
      ip: req.headers.get('x-forwarded-for') ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
    });

    const loginUrl = getPublicBaseUrl() + '/login';
    const tpl = buildPasswordReset({
      name: rows[0].name,
      tempPassword,
      loginUrl,
    });
    const emailResult = rows[0].email
      ? await sendEmail({
          to: rows[0].email,
          subject: tpl.subject,
          html: tpl.html,
          text: tpl.text,
        })
      : { ok: false as const, error: 'no email' };
    const smsResult = rows[0].phone
      ? await sendSms({ to: rows[0].phone, text: tpl.sms })
      : { ok: false as const, error: 'no phone' };

    return NextResponse.json({
      ok: true,
      data: {
        tempPassword,
        emailSent: emailResult.ok,
        smsSent: smsResult.ok,
      },
    });
  } catch (err) {
    console.error('[POST reset-password] 실패:', err);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}
