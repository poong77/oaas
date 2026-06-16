'use client';

/**
 * 공용 수신자 선택기.
 * - 호텔 검색 → 연락처 칩 추가 (기존)
 * - MSG-17: 연락처 엑셀 업로드 (업체명·연락처·변수명1~7)
 * - MSG-18: 호텔리어 전체 불러오기 (이메일/문자)
 */

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Search, Upload, Users, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConfirmDialog } from '@/components/dialogs/confirm-dialog';
import {
  getHotelContactsAction,
  parseRecipientsExcelAction,
  listHoteliersAsRecipientsAction,
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
  const [searching, setSearching] = useState(false);
  const [contacts, setContacts] = useState<string[] | null>(null);
  const [people, setPeople] = useState<Array<{ name: string; email: string | null; phone: string | null }>>([]);
  const [pickedHotel, setPickedHotel] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const [loadingAll, startLoadAll] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function searchHotels() {
    if (query.trim().length === 0) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/hotels?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' });
      const json = (await res.json()) as { ok: boolean; items?: HotelHit[] };
      setHits(json.ok ? (json.items ?? []) : []);
    } catch {
      toast.error('호텔 검색 실패');
    } finally {
      setSearching(false);
    }
  }

  async function pickHotel(h: HotelHit) {
    setPickedHotel(h.name);
    setHits([]);
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
      const res = await listHoteliersAsRecipientsAction({ channel: mode === 'email' ? 'email' : 'sms' });
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

  const count = parseRecipients(value).length;

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">
        수신자 ({mode === 'email' ? '이메일' : '전화번호'}) · {count}명
      </Label>

      {/* 호텔 검색 */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void searchHotels();
              }
            }}
            placeholder="호텔명으로 연락처 불러오기"
            className="h-9 pl-8"
          />
          {hits.length > 0 && (
            <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => pickHotel(h)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-950/30"
                >
                  {h.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={searchHotels} disabled={searching}>
          {searching ? '검색…' : '검색'}
        </Button>
      </div>

      {/* MSG-17/18 — 일괄 불러오기 액션바 */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={onPickFile}
          className="hidden"
        />
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

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        placeholder={
          mode === 'email'
            ? '이메일 주소를 줄바꿈/쉼표로 구분해 입력하거나 위에서 추가하세요'
            : '전화번호를 줄바꿈/쉼표로 구분해 입력하거나 위에서 추가하세요'
        }
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-900"
      />
    </div>
  );
}
