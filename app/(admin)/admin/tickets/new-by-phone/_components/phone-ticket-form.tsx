'use client';

/**
 * 대리 접수 폼 (IC-04 확장) — 매니저/어드민이 외부 채널 문의를 대신 접수.
 *
 * 단순화 (3단계 스텝퍼 X — 한 페이지에 다 펼침).
 * 채널/호텔/접수자 선택 + 일반 접수폼과 동일한 필수 항목.
 * 채널은 ticket_channels 마스터에서 선택 (Plan ticket-channels-master Q-1 검증).
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { AlertCircle, Headset, Phone, Send } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { createTicketByPhoneAction } from '@/app/actions/ticket-actions';
import {
  AttachmentUploader,
  type UploadedAttachment,
} from '@/app/tickets/new/_components/attachment-uploader';

type CategoryItem = { code: string; label: string };
type HotelItem = { id: string; name: string; oaPmsHotelId: string | null };
type HotelierOption = { id: string; name: string; email: string };
type ChannelOption = { code: string; label: string; isAgentDefault: boolean };

export function PhoneTicketForm({
  channels,
  hotels,
  productCategories,
  issueTypeCategories,
  urgencyCategories,
  impactCategories,
}: {
  channels: ChannelOption[];
  hotels: HotelItem[];
  productCategories: CategoryItem[];
  issueTypeCategories: CategoryItem[];
  urgencyCategories: CategoryItem[];
  impactCategories: CategoryItem[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 기본값: isAgentDefault=true 채널 (없으면 첫 번째, 그것도 없으면 'phone')
  const defaultChannelCode =
    channels.find((c) => c.isAgentDefault)?.code ??
    channels[0]?.code ??
    'phone';
  const [channel, setChannel] = useState<string>(defaultChannelCode);

  const [hotelId, setHotelId] = useState<string>('');
  const [reporterId, setReporterId] = useState<string>('');
  const [hoteliers, setHoteliers] = useState<HotelierOption[]>([]);
  const [productCode, setProductCode] = useState<string>('');
  const [issueType, setIssueType] = useState<string>('');
  const [urgency, setUrgency] = useState<string>('p2');
  const [impactScope, setImpactScope] = useState<string>('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [contactMethods, setContactMethods] = useState<Array<'sms' | 'email'>>(
    ['sms'],
  );

  // 호텔 선택 시 해당 호텔리어 목록 fetch
  async function onHotelChange(nextHotelId: string) {
    setHotelId(nextHotelId);
    setReporterId('');
    setHoteliers([]);
    if (!nextHotelId) return;
    try {
      const res = await fetch(
        `/api/admin/hoteliers?hotelId=${encodeURIComponent(nextHotelId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json().catch(() => ({}));
      if (json?.items) setHoteliers(json.items);
    } catch {
      // 무시 — 폼은 hotelId만으로도 제출 가능
    }
  }

  function toggleContact(m: 'sms' | 'email') {
    setContactMethods((prev) =>
      prev.includes(m) ? prev.filter((v) => v !== m) : [...prev, m],
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    setFieldErrors({});

    const fd = new FormData();
    fd.append('channel', channel);
    if (hotelId) fd.append('hotelId', hotelId);
    if (reporterId) fd.append('reporterId', reporterId);
    fd.append('productCode', productCode);
    fd.append('issueType', issueType);
    fd.append('urgency', urgency);
    if (impactScope) fd.append('impactScope', impactScope);
    fd.append('title', title.trim());
    fd.append('content', content.trim());
    for (const m of contactMethods) fd.append('contactMethods', m);
    fd.append('attachments', JSON.stringify(attachments));
    // customFields.from='phone'은 channel 컬럼이 정식 필드라 불필요 (Design §9.3)

    startTransition(async () => {
      const result = await createTicketByPhoneAction(undefined, fd);
      if (!result.ok) {
        setServerError(result.message ?? '저장 실패');
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      if (result.ticketId) {
        router.push(`/admin/tickets/${result.ticketId}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div>
            <Label required title="유입 채널" error={fieldErrors.channel} />
            <Select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              disabled={pending}
            >
              {channels.length === 0 && (
                <option value="phone">전화 (기본)</option>
              )}
              {channels.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                  {c.isAgentDefault ? ' (기본)' : ''}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              고객이 어떤 경로로 문의를 보내왔는지 선택해주세요. 채널은
              어드민이 마스터에서 추가/수정할 수 있습니다.
            </p>
          </div>

          <div>
            <Label required title="호텔" />
            <Select
              value={hotelId}
              onChange={(e) => onHotelChange(e.target.value)}
              disabled={pending}
            >
              <option value="">호텔을 선택하세요</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                  {h.oaPmsHotelId ? ` (${h.oaPmsHotelId})` : ''}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              호텔이 매핑되지 않으면 호텔리어 알림이 발송되지 않을 수 있습니다.
            </p>
          </div>

          {hotelId && hoteliers.length > 0 && (
            <div>
              <Label title="접수 호텔리어 (선택)" />
              <Select
                value={reporterId}
                onChange={(e) => setReporterId(e.target.value)}
                disabled={pending}
              >
                <option value="">— 매니저 본인을 접수자로 기록 —</option>
                {hoteliers.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} · {h.email}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                선택 시 해당 호텔리어가 접수자로 등록되어, 본인 마이페이지에서도 보입니다.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label required title="제품" error={fieldErrors.productCode} />
              <Select
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                disabled={pending}
              >
                <option value="">선택</option>
                {productCategories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label required title="유형" error={fieldErrors.issueType} />
              <Select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                disabled={pending}
              >
                <option value="">선택</option>
                {issueTypeCategories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label required title="긴급도" error={fieldErrors.urgency} />
              <Select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                disabled={pending}
              >
                {urgencyCategories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label title="영향범위" />
              <Select
                value={impactScope}
                onChange={(e) => setImpactScope(e.target.value)}
                disabled={pending}
              >
                <option value="">선택 안 함</option>
                {impactCategories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label required title="제목" error={fieldErrors.title} />
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="전화 통화 핵심 내용"
              maxLength={200}
              disabled={pending}
            />
          </div>
          <div>
            <Label
              required
              title="통화 내용 (재현·증상·요청사항)"
              error={fieldErrors.content}
            />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder="통화 도중 들은 내용을 가능한 한 그대로 받아적어주세요. 시간·재현 단계·고객 발언을 그대로 옮기면 후속 처리가 빨라집니다."
              disabled={pending}
              className="font-mono text-sm"
            />
          </div>

          <div>
            <Label title="첨부 (선택)" />
            <AttachmentUploader
              attachments={attachments}
              onChange={setAttachments}
              disabled={pending}
            />
          </div>

          <div>
            <Label title="호텔리어 자동 알림" />
            <div className="flex flex-wrap gap-2">
              <ContactPill
                selected={contactMethods.includes('sms')}
                label="SMS"
                onToggle={() => toggleContact('sms')}
              />
              <ContactPill
                selected={contactMethods.includes('email')}
                label="이메일"
                onToggle={() => toggleContact('email')}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              호텔리어가 매핑된 경우 선택한 방법으로 접수확인이 발송됩니다.
            </p>
          </div>

          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              size="lg"
              disabled={pending || !productCode || !issueType}
            >
              {pending ? (
                '저장 중...'
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  티켓 발급
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        <Phone className="mr-1 inline h-3 w-3" />
        전화 접수는 `channel=phone`으로 저장되며, 통화 메모는 본문 그대로
        보존됩니다.
      </p>
    </form>
  );
}

function Label({
  title,
  required,
  error,
}: {
  title: string;
  required?: boolean;
  error?: string;
}) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {title}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

function ContactPill({
  selected,
  label,
  onToggle,
}: {
  selected: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        selected
          ? 'rounded-md border border-brand-400 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
          : 'rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-700 dark:hover:bg-brand-950/20'
      }
    >
      {label}
    </button>
  );
}
