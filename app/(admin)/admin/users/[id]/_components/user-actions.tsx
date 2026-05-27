'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { KeyRound, Power } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  resetUserPasswordAdminAction,
  toggleUserActiveAdminAction,
} from '@/app/actions/admin-user-actions';

export function UserActions({
  target,
  meId,
}: {
  target: { id: string; name: string; email: string; isActive: boolean };
  meId: string;
}) {
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const isSelf = target.id === meId;

  async function handleReset() {
    const ok = await confirm({
      title: `${target.name}님의 비밀번호를 초기화하시겠습니까?`,
      description: `임시 비밀번호가 SMS/이메일로 발송되며, 첫 로그인 시 변경이 강제됩니다.`,
      confirmText: '초기화',
      tone: 'danger',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('id', target.id);
    startTransition(async () => {
      const res = await resetUserPasswordAdminAction(fd);
      if (res.ok && res.data) {
        toast.success(
          `임시비번 ${res.data.tempPassword} 발급 (이메일: ${res.data.emailSent ? '발송' : '미발송'} / SMS: ${res.data.smsSent ? '발송' : '미발송'})`,
          { duration: 12000 },
        );
      } else if (!res.ok) {
        toast.error(res.error);
      }
    });
  }

  async function handleToggle() {
    if (isSelf) {
      toast.error('본인 계정은 비활성화할 수 없습니다');
      return;
    }
    const next = !target.isActive;
    const ok = await confirm({
      title: next
        ? `${target.name}님을 다시 활성화하시겠습니까?`
        : `${target.name}님을 비활성화하시겠습니까?`,
      description: next
        ? '다시 로그인할 수 있게 됩니다.'
        : '비활성화하면 로그인이 차단됩니다. 이력은 모두 보존됩니다.',
      confirmText: next ? '활성화' : '비활성화',
      tone: next ? 'default' : 'danger',
    });
    if (!ok) return;
    const fd = new FormData();
    fd.set('id', target.id);
    startTransition(async () => {
      const res = await toggleUserActiveAdminAction(fd);
      if (res.ok) toast.success('변경되었습니다');
      else toast.error(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>관리 작업</CardTitle>
        <CardDescription>
          비밀번호 초기화 · 계정 활성/비활성. 모든 작업은 감사 로그에 기록됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={handleReset} disabled={pending}>
          <KeyRound className="h-4 w-4" />비밀번호 초기화
        </Button>
        <Button
          type="button"
          variant={target.isActive ? 'destructive' : 'default'}
          onClick={handleToggle}
          disabled={pending || isSelf}
        >
          <Power className="h-4 w-4" />
          {target.isActive ? '계정 비활성화' : '계정 활성화'}
        </Button>
        {isSelf && (
          <p className="w-full text-xs text-amber-600">
            본인 계정은 비활성화할 수 없습니다.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
