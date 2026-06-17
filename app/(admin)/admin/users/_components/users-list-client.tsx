'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Copy,
  UserCheck,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PageSizeSelect } from '@/components/admin/page-size-select';
import { BulkActionBar } from '@/components/admin/bulk-action-bar';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import { bulkSetUsersActiveAction } from '@/app/actions/admin-user-actions';
import { formatDateKst } from '@/lib/business-hours/format';
import { toLoginId, isDummyEmail } from '@/lib/text/login-id';
import type { User, UserRole } from '@/db/schema';

type ListItem = User & { hotelName: string | null };

/** 초기 비밀번호 (lib/actions 정책과 동일). */
const INITIAL_PASSWORD = '123456';

/** 계정 안내문 생성 — 접속주소 · 아이디 · 초기 비밀번호 포함. */
function buildAccountGuide(u: ListItem): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://support.oapms.com';
  const loginId = u.username ?? toLoginId(u.email);
  const hotel = u.hotelName ?? u.name;
  return [
    `[OA서포트] ${hotel} 계정 안내`,
    '',
    `▷ 접속 주소: ${origin}`,
    `▷ 아이디: ${loginId}`,
    `▷ 초기 비밀번호: ${INITIAL_PASSWORD}`,
    '',
    'OA 솔루션 사용에 필요한 매뉴얼, 문의접수, 연락처 등 여러 유용한 정보를 확인할 수 있습니다.',
    '첫 로그인 후 프로필에서 연락처·이메일 주소 등 정보를 확인해주세요.',
  ].join('\n');
}

async function copyAccountGuide(u: ListItem) {
  try {
    await navigator.clipboard.writeText(buildAccountGuide(u));
    toast.success(`${u.name}님 계정 안내문이 복사되었습니다`);
  } catch {
    toast.error('복사에 실패했습니다. 다시 시도해주세요.');
  }
}

export function UsersListClient({
  items,
  total,
  page,
  pageSize,
}: {
  items: ListItem[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const confirm = useConfirmDialog();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const pageIds = useMemo(() => items.map((u) => u.id), [items]);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someSelected = pageIds.some((id) => selected.has(id));

  function go(p: number) {
    const next = new URLSearchParams(sp.toString());
    next.set('page', String(p));
    router.push(`/admin/users?${next.toString()}`);
  }

  function open(id: string) {
    router.push(`/admin/users/${id}`);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function bulkSetActive(active: boolean) {
    const ids = [...selected];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: active
        ? `${ids.length}명을 활성화하시겠습니까?`
        : `${ids.length}명을 비활성화하시겠습니까?`,
      description: active
        ? '선택한 계정이 로그인 가능 상태로 전환됩니다.'
        : '선택한 계정의 로그인이 차단됩니다. 접수 이력은 보존되며 언제든 다시 활성화할 수 있습니다.',
      confirmText: active ? '활성화' : '비활성화',
      tone: active ? 'default' : 'danger',
    });
    if (!ok) return;

    const fd = new FormData();
    fd.set('ids', ids.join(','));
    fd.set('active', active ? '1' : '0');
    startTransition(async () => {
      const res = await bulkSetUsersActiveAction(fd);
      if (res.ok) {
        const { affected, skippedSelf } = res.data ?? { affected: 0, skippedSelf: false };
        toast.success(
          `${affected}명이 ${active ? '활성화' : '비활성화'}되었습니다` +
            (skippedSelf ? ' (본인 계정 제외)' : ''),
        );
        clearSelection();
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      {/* ───────── 일괄 작업 바 ───────── */}
      <BulkActionBar count={selected.size} onClear={clearSelection}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => bulkSetActive(true)}
        >
          <UserCheck className="h-3.5 w-3.5" />활성화
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => bulkSetActive(false)}
          className="text-red-600 hover:text-red-700 dark:text-red-400"
        >
          <UserX className="h-3.5 w-3.5" />비활성화
        </Button>
      </BulkActionBar>

      {/* ───────── 데스크탑 테이블 ───────── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <tr>
              <th className="w-10 px-3 py-2.5 text-left">
                <Checkbox
                  checked={allSelected}
                  indeterminate={!allSelected && someSelected}
                  onChange={toggleAll}
                  aria-label="이 페이지 전체 선택"
                />
              </th>
              <th className="px-4 py-2.5 text-left font-medium">사용자</th>
              <th className="px-4 py-2.5 text-left font-medium">호텔</th>
              <th className="px-4 py-2.5 text-left font-medium">연락처</th>
              <th className="px-4 py-2.5 text-left font-medium">활동</th>
              <th className="px-4 py-2.5 text-left font-medium">상태</th>
              <th className="w-20 px-2 py-2.5 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((u) => {
              const loginId = u.username ?? toLoginId(u.email);
              const checked = selected.has(u.id);
              return (
                <tr
                  key={u.id}
                  onClick={() => open(u.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') open(u.id);
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`${u.name} 편집`}
                  className={`group cursor-pointer outline-none transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 dark:hover:bg-slate-800/40 dark:focus-visible:bg-slate-800/40 ${
                    checked ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''
                  } ${u.isActive ? '' : 'bg-slate-50/40 dark:bg-slate-900/30'}`}
                >
                  {/* 선택 체크박스 */}
                  <td
                    className="w-10 px-3 py-2.5"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={() => toggle(u.id)}
                      aria-label={`${u.name} 선택`}
                    />
                  </td>

                  {/* 사용자: 아바타 + 이름 + 권한 + 아이디 */}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} seed={u.id} dim={!u.isActive} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`truncate font-medium ${u.isActive ? 'text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}
                          >
                            {u.name}
                          </span>
                          <RoleBadge role={u.role} />
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                          {loginId ? (
                            <span className="truncate font-mono">{loginId}</span>
                          ) : (
                            <span className="text-slate-400">아이디 없음</span>
                          )}
                          {u.title && (
                            <>
                              <span className="text-slate-300 dark:text-slate-600">·</span>
                              <span className="truncate">{u.title}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 호텔 */}
                  <td className="px-4 py-2.5">
                    {u.hotelName ? (
                      <span className="text-slate-700 dark:text-slate-300">{u.hotelName}</span>
                    ) : (
                      <span className="text-slate-400">소속 없음</span>
                    )}
                  </td>

                  {/* 연락처: 이메일 + 전화 */}
                  <td className="px-4 py-2.5">
                    <div className="text-slate-600 dark:text-slate-300">
                      {isDummyEmail(u.email) ? (
                        <span className="text-slate-400">이메일 미등록</span>
                      ) : (
                        <span className="truncate">{u.email}</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {u.phone ? formatPhone(u.phone) : <span className="text-slate-400">—</span>}
                    </div>
                  </td>

                  {/* 활동: 최근 로그인 + 가입 */}
                  <td className="px-4 py-2.5">
                    <div className="text-xs">
                      {u.lastLoginAt ? (
                        <span className="text-slate-600 dark:text-slate-300">
                          {formatDateKst(u.lastLoginAt)}
                        </span>
                      ) : (
                        <span className="text-slate-400">미접속</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      가입 {formatDateKst(u.createdAt)}
                    </div>
                  </td>

                  {/* 상태 */}
                  <td className="px-4 py-2.5">
                    <StatusDot active={u.isActive} />
                  </td>

                  {/* 관리: 안내문 복사 + 수정 */}
                  <td className="w-20 px-2 py-2.5">
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        type="button"
                        title="계정 안내문 복사 (주소·아이디·비밀번호)"
                        aria-label={`${u.name} 계정 안내문 복사`}
                        onClick={(e) => {
                          e.stopPropagation();
                          copyAccountGuide(u);
                        }}
                        className="rounded p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800 dark:hover:text-brand-400"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <span
                        aria-hidden
                        className="rounded p-1.5 text-slate-300 transition-colors group-hover:text-brand-600 dark:text-slate-600 dark:group-hover:text-brand-400"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ───────── 모바일 카드뷰 ───────── */}
      <div className="flex flex-col gap-2.5 p-3 md:hidden">
        {items.map((u) => {
          const loginId = u.username ?? toLoginId(u.email);
          const checked = selected.has(u.id);
          return (
            <Link
              key={u.id}
              href={`/admin/users/${u.id}`}
              className={`rounded-xl border p-3.5 transition-colors active:bg-slate-50 dark:active:bg-slate-800/40 ${
                checked
                  ? 'border-brand-300 bg-brand-50/40 dark:border-brand-800 dark:bg-brand-950/20'
                  : u.isActive
                    ? 'border-slate-200 dark:border-slate-800'
                    : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggle(u.id);
                  }}
                  className="flex h-9 items-center"
                >
                  <Checkbox
                    checked={checked}
                    onChange={() => {}}
                    aria-label={`${u.name} 선택`}
                    tabIndex={-1}
                  />
                </span>
                <Avatar name={u.name} seed={u.id} dim={!u.isActive} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`truncate font-semibold ${u.isActive ? '' : 'text-slate-500'}`}
                    >
                      {u.name}
                    </span>
                    <RoleBadge role={u.role} />
                  </div>
                  <div className="mt-0.5 truncate text-xs text-slate-500">
                    {u.hotelName ?? '소속 없음'}
                    {u.title && ` · ${u.title}`}
                  </div>
                </div>
                <StatusDot active={u.isActive} />
              </div>

              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                <dt className="text-slate-400">아이디</dt>
                <dd className="truncate font-mono text-slate-700 dark:text-slate-300">
                  {loginId || '—'}
                </dd>
                <dt className="text-slate-400">이메일</dt>
                <dd className="truncate text-slate-600 dark:text-slate-300">
                  {isDummyEmail(u.email) ? '미등록' : u.email}
                </dd>
                <dt className="text-slate-400">연락처</dt>
                <dd className="text-slate-600 dark:text-slate-300">
                  {u.phone ? formatPhone(u.phone) : '—'}
                </dd>
                <dt className="text-slate-400">최근 접속</dt>
                <dd className="text-slate-600 dark:text-slate-300">
                  {u.lastLoginAt ? formatDateKst(u.lastLoginAt) : '미접속'}
                </dd>
              </dl>

              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  copyAccountGuide(u);
                }}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 py-2 text-xs font-medium text-slate-600 active:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:active:bg-slate-800"
              >
                <Copy className="h-3.5 w-3.5" />
                계정 안내문 복사
              </button>
            </Link>
          );
        })}
      </div>

      {/* ───────── 페이지네이션 ───────── */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm dark:border-slate-800 sm:flex-row">
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-500">
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
            </span>
            {' / '}
            {total.toLocaleString()}명
          </div>
          <PageSizeSelect pageSize={pageSize} />
        </div>
        {lastPage > 1 && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => go(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />이전
            </Button>
            <span className="px-2 text-xs tabular-nums text-slate-500">
              <span className="font-semibold text-slate-700 dark:text-slate-300">{page}</span>
              {' / '}
              {lastPage}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= lastPage}
              onClick={() => go(page + 1)}
            >
              다음<ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// ───────── 보조 컴포넌트 ─────────

const AVATAR_TONES = [
  'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
];

function Avatar({ name, seed, dim }: { name: string; seed: string; dim?: boolean }) {
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const tone = AVATAR_TONES[hash % AVATAR_TONES.length];
  return (
    <span
      aria-hidden
      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${tone} ${dim ? 'opacity-60 grayscale' : ''}`}
    >
      {initial}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
          active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      />
      <span
        className={`text-xs ${active ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}`}
      >
        {active ? '활성' : '비활성'}
      </span>
    </span>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const tone = role === 'admin' ? 'danger' : role === 'manager' ? 'warn' : 'brand';
  const label = role === 'admin' ? '어드민' : role === 'manager' ? '매니저' : '호텔리어';
  return <Badge tone={tone}>{label}</Badge>;
}

/** 010-1234-5678 형태로 가볍게 정리 (이미 하이픈이면 그대로). */
function formatPhone(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10)
    return d.startsWith('02')
      ? `${d.slice(0, 2)}-${d.slice(2, 6)}-${d.slice(6)}`
      : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return raw;
}
