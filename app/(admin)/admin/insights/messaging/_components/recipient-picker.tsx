'use client';

/**
 * 공용 수신자 선택기 (2단 레이아웃).
 * - 좌: 수신자 추가 — 호텔/사용자명 검색, 엑셀 업로드, 호텔리어 전체, 양식 다운로드
 * - 우: 수신자 확인 — 추가된 주소 칩(개별 삭제) + 직접 입력
 *
 * MSG-17 엑셀 업로드, MSG-18 호텔리어 전체, + 사용자명 검색.
 */

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Search, Upload, Users, FileDown, X, Building2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  getHotelContactsAction,
  parseRecipientsExcelAction,
  listHoteliersAsRecipientsAction,
  searchRecipientUsersAction,
  type RecipientUserHit,
} from '@/app/actions/messaging-actions';
import { parseRecipients, type HotelHit } from './shared';

export type PickerMeta = {
  hotel: string | null;
  person?: string | null;
  phone?: string | null;
  excel?: Record<string, string>;
};

/** 파일 → base64(헤더 제외). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result ?? '');
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function RecipientPicker({
  mode,
  value,
  onChange,
  onMeta,
  onVarNames,
}: {
  mode: 'email' | 'phone';
  value: string;
  onChange: (v: string) => void;
  onMeta: (address: string, meta: PickerMeta) => void;
  /** 엑셀에서 발견한 커스텀 변수명 등록. */
  onVarNames?: (names: string[]) => void;
}) {
  const confirm = useConfirmDialog();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<HotelHit[]>([]);
  const [userHits, setUserHits] = useState<RecipientUserHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [contacts, setContacts] = useState<string[] | null>(null);
  const [people, setPeople] = useState<Array<{ name: string; email: string | null; phone: string | null }>>([]);
  const [pickedHotel, setPickedHotel] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [uploading, startUpload] = useTransition();
  const [loadingAll, startLoadAll] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const channel = mode === 'email' ? 'email' : 'sms';

  // 호텔명 + 사용자명 동시 검색.
  async function runSearch() {
    const q = query.trim();
    if (q.length === 0) return;
    setSearching(true);
    setSearched(true);
    try {
      const [hotelRes, userRes] = await Promise.all([
        fetch(`/api/admin/hotels?q=${encodeURIComponent(q)}`, { cache: 'no-store' })
          .then((r) => r.json() as Promise<{ ok: boolean; items?: HotelHit[] }>)
          .catch(() => ({ ok: false, items: [] as HotelHit[] })),
        searchRecipientUsersAction({ q, channel }),
      ]);
      setHits(hotelRes.ok ? (hotelRes.items ?? []) : []);
      setUserHits(userRes.ok ? (userRes.users ?? []) : []);
    } catch {
      toast.error('검색 실패');
    } finally {
      setSearching(false);
    }
  }

  function closeDropdown() {
    setHits([]);
    setUserHits([]);
    setSearched(false);
  }

  async function pickHotel(h: HotelHit) {
    setPickedHotel(h.name);
    closeDropdown();
    setQuery(h.name);
    const res = await getHotelContactsAction(h.id);
    if (!res.ok) {
      toast.error(res.message ?? '연락처 조회 실패');
      setContacts([]);
      setPeople([]);
      return;
    }
    setPeople(res.people ?? []);
    setContacts(mode === 'email' ? (res.emails ?? []) : (res.phones ?? []));
  }

  // 검색 드롭다운에서 개별 사용자 직접 추가.
  function pickUser(u: RecipientUserHit) {
    if (!u.address) {
      toast.error(mode === 'email' ? '이메일이 없는 사용자입니다' : '휴대폰번호가 없는 사용자입니다');
      return;
    }
    const cur = parseRecipients(value);
    onMeta(u.address, { hotel: u.hotel, person: u.name || null, phone: u.phone });
    if (!cur.includes(u.address)) {
      onChange([...cur, u.address].join('\n'));
      toast.success(`${u.name || u.address} 추가`);
    } else {
      toast.info('이미 추가된 수신자입니다');
    }
  }

  function reportMeta(c: string) {
    if (!pickedHotel) return;
    const person =
      mode === 'email'
        ? people.find((p) => p.email === c)
        : people.find((p) => (p.phone ?? '').replace(/[^0-9]/g, '') === c.replace(/[^0-9]/g, ''));
    onMeta(c, {
      hotel: pickedHotel,
      person: person?.name ?? null,
      phone: mode === 'phone' ? c : (person?.phone ?? null),
    });
  }

  function addOne(c: string) {
    const cur = parseRecipients(value);
    reportMeta(c);
    if (cur.includes(c)) return;
    onChange([...cur, c].join('\n'));
  }
  function addAll() {
    if (!contacts) return;
    contacts.forEach(reportMeta);
    const merged = [...new Set([...parseRecipients(value), ...contacts])];
    onChange(merged.join('\n'));
    toast.success(`${contacts.length}건 추가`);
  }

  // 우측 — 직접 입력 → 목록 병합.
  function addDraft() {
    const adds = parseRecipients(draft);
    if (adds.length === 0) return;
    const merged = [...new Set([...parseRecipients(value), ...adds])];
    onChange(merged.join('\n'));
    setDraft('');
    toast.success(`${adds.length}건 추가`);
  }

  // 우측 — 개별 삭제 / 전체 비우기.
  function removeOne(addr: string) {
    onChange(parseRecipients(value).filter((a) => a !== addr).join('\n'));
  }
  async function clearAll() {
    if (recipients.length === 0) return;
    const ok = await confirm({
      title: '수신자 전체 비우기',
      description: `추가된 수신자 ${recipients.length}명을 모두 제거합니다.`,
      confirmText: '비우기',
      tone: 'danger',
    });
    if (ok) onChange('');
  }

  // MSG-17 — 엑셀 업로드
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    startUpload(async () => {
      try {
        const fileBase64 = await fileToBase64(file);
        const res = await parseRecipientsExcelAction({ fileBase64 });
        if (!res.ok || !res.rows) {
          toast.error(res.message ?? '엑셀 파싱 실패');
          return;
        }
        const adds: string[] = [];
        for (const row of res.rows) {
          const address = mode === 'email' ? row.email : row.phone;
          if (!address) continue;
          adds.push(address);
          onMeta(address, {
            hotel: row.company,
            person: row.person,
            phone: row.phone,
            excel: row.vars,
          });
        }
        if (adds.length === 0) {
          toast.error(mode === 'email' ? '이메일이 있는 행이 없습니다' : '휴대폰번호가 있는 행이 없습니다');
          return;
        }
        if (res.varNames && res.varNames.length > 0) onVarNames?.(res.varNames);
        const merged = [...new Set([...parseRecipients(value), ...adds])];
        onChange(merged.join('\n'));
        const errCnt = res.errors?.length ?? 0;
        toast.success(`엑셀 ${adds.length}건 추가${errCnt > 0 ? ` · 오류 ${errCnt}행 제외` : ''}`);
      } catch (err) {
        console.error(err);
        toast.error('엑셀 처리 중 오류');
      }
    });
  }

  // MSG-18 — 호텔리어 전체 불러오기
  async function loadAllHoteliers() {
    const ok = await confirm({
      title: '호텔리어 전체 불러오기',
      description:
        mode === 'email'
          ? '활성 호텔리어 전체를 이메일 수신자로 추가합니다(이메일 보유 계정만).'
          : '활성 호텔리어 전체를 문자 수신자로 추가합니다(휴대폰 보유 계정만).',
      confirmText: '불러오기',
    });
    if (!ok) return;
    startLoadAll(async () => {
      const res = await listHoteliersAsRecipientsAction({ channel });
      if (!res.ok || !res.recipients) {
        toast.error(res.message ?? '호텔리어 조회 실패');
        return;
      }
      const adds: string[] = [];
      for (const r of res.recipients) {
        adds.push(r.address);
        onMeta(r.address, {
          hotel: r.company ?? null,
          person: r.auto?.['담당자명'] ?? null,
          phone: r.auto?.['연락처'] ?? null,
        });
      }
      const merged = [...new Set([...parseRecipients(value), ...adds])];
      onChange(merged.join('\n'));
      toast.success(`호텔리어 ${res.count ?? adds.length}명 추가${res.skipped ? ` · ${res.skipped}명 제외(주소 없음)` : ''}`);
    });
  }

  const recipients = parseRecipients(value);
  const dropdownOpen = searched && (hits.length > 0 || userHits.length > 0);

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">
        수신자 ({mode === 'email' ? '이메일' : '전화번호'}) · {recipients.length}명
      </Label>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {/* ── 좌: 수신자 추가 ───────────────────────────── */}
        <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5 dark:border-slate-700">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">수신자 추가</span>

          {/* 호텔명 · 사용자명 검색 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void runSearch();
                  }
                }}
                placeholder="호텔명 · 사용자명으로 검색"
                className="h-9 pl-8"
              />
              {dropdownOpen && (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {userHits.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">사용자</div>
                      {userHits.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => pickUser(u)}
                          disabled={!u.address}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-brand-50 disabled:opacity-40 dark:hover:bg-brand-950/30"
                        >
                          <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="font-medium">{u.name || '(이름없음)'}</span>
                          <span className="truncate text-xs text-slate-400">
                            {u.hotel ? `${u.hotel} · ` : ''}
                            {u.address ?? (mode === 'email' ? '이메일 없음' : '번호 없음')}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {hits.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">호텔</div>
                      {hits.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => pickHotel(h)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-950/30"
                        >
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          {h.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={runSearch} disabled={searching}>
              {searching ? '검색…' : '검색'}
            </Button>
          </div>
          {searched && !searching && !dropdownOpen && (
            <p className="text-[11px] text-slate-400">검색 결과가 없습니다.</p>
          )}

          {/* MSG-17/18 — 일괄 불러오기 액션바 */}
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onPickFile} className="hidden" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" />
              {uploading ? '업로드 중…' : '엑셀 업로드'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={loadAllHoteliers} disabled={loadingAll}>
              <Users className="h-4 w-4" />
              {loadingAll ? '불러오는 중…' : '호텔리어 전체'}
            </Button>
            <a
              href="/api/admin/messaging/recipient-template"
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-brand-600 hover:underline"
            >
              <FileDown className="h-3.5 w-3.5" />
              양식 다운로드
            </a>
          </div>
          <p className="text-[11px] text-slate-400">
            엑셀 컬럼: 업체명 · {mode === 'email' ? '이메일' : '연락처(휴대폰)'}(필수) · 담당자명 · 변수명1~7
          </p>

          {/* 호텔 선택 시 연락처 칩 */}
          {contacts && (
            <div className="rounded-md border border-slate-200 p-2 dark:border-slate-700">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {pickedHotel} · 연락처 {contacts.length}건
                </span>
                {contacts.length > 0 && (
                  <button
                    type="button"
                    onClick={addAll}
                    className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    전체 추가
                  </button>
                )}
              </div>
              {contacts.length === 0 ? (
                <p className="text-xs text-slate-400">등록된 연락처가 없습니다.</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {contacts.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => addOne(c)}
                      className="rounded-full border border-slate-200 px-2 py-0.5 text-xs hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-brand-950/30"
                    >
                      + {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 우: 수신자 확인 ───────────────────────────── */}
        <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-2.5 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              수신자 목록 · {recipients.length}명
            </span>
            {recipients.length > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-[11px] text-slate-400 hover:text-rose-600 hover:underline"
              >
                전체 비우기
              </button>
            )}
          </div>

          {recipients.length === 0 ? (
            <div className="flex min-h-[88px] flex-1 items-center justify-center rounded-md border border-dashed border-slate-200 text-center text-xs text-slate-400 dark:border-slate-700">
              왼쪽에서 수신자를 추가하거나
              <br />
              아래에 직접 입력하세요
            </div>
          ) : (
            <div className="flex max-h-44 flex-1 flex-wrap content-start gap-1 overflow-auto rounded-md border border-slate-100 p-1.5 dark:border-slate-800">
              {recipients.map((addr) => (
                <span
                  key={addr}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  {addr}
                  <button
                    type="button"
                    onClick={() => removeOne(addr)}
                    className="rounded-full p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40"
                    aria-label={`${addr} 제거`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 직접 입력 */}
          <div className="flex flex-col gap-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  addDraft();
                }
              }}
              rows={2}
              placeholder={
                mode === 'email'
                  ? '이메일을 줄바꿈/쉼표로 구분해 입력 (⌘/Ctrl+Enter로 추가)'
                  : '전화번호를 줄바꿈/쉼표로 구분해 입력 (⌘/Ctrl+Enter로 추가)'
              }
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={addDraft} disabled={draft.trim().length === 0}>
                직접 추가
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
