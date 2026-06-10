'use client';

/**
 * InquiryForm — 문의하기 폼 (Figma node 36:509 및 선택/입력 상태 변형).
 *
 * 카드 구성:
 *   ① 문제분류 — 문의 프로그램(단일 선택) · 상세 유형(단일 선택) 칩
 *   ② 상세 내용 — 제목 입력 · 상세 내용(예시 채우기 + 글자수) · 첨부 파일(드롭존)
 *   ③ 연락 방법 — 이메일/SMS 다중 선택
 *   접수하기 버튼
 *
 * 색상 토큰 (Figma 추출):
 *   bg #F3F4F5 · card #FFF · brand #00A36B · 선택 틴트 #E6F7F0
 *   border #DCDEE3 / rgba(0,0,0,0.06) · 필수 #FA342C · 보조텍스트 #868B94/#555D6D
 *   예시배지 #EFF6FF/#217CF9 · 드롭존 #F7F8F9
 *
 * 시안용으로 실제 접수 API에는 미연결 상태.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Paperclip, Mail, MessageSquareText, Check } from 'lucide-react';

/** 호텔리어 템플릿 — 마스터DB(hotelier_templates)에서 전달. */
type InquiryTemplate = { id: string; title: string; content: string };

const PROGRAMS = ['PMS', 'CMS', 'Keyless', '키오스크', '웹서비스', '도어락', '기타'];
const DETAIL_TYPES = ['기능오류', '시스템장애', '기능문의', '기능개발', '데이터수정', '오버부킹', '기타'];
const MAX_CONTENT = 20000;

function Required() {
  return <span className="text-[#FA342C]">*</span>;
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-lg border px-5 py-3.5 text-base font-medium transition-colors ${
        selected
          ? 'border-[#00A36B] bg-[#E6F7F0] text-[#00A36B]'
          : 'border-black/[0.06] bg-white text-[#1A1C20] hover:bg-[#F7F8F9]'
      }`}
    >
      {label}
    </button>
  );
}

export function InquiryForm({ templates = [] }: { templates?: InquiryTemplate[] }) {
  const [program, setProgram] = useState<string | null>(null);
  const [detailType, setDetailType] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contacts, setContacts] = useState<Set<'email' | 'sms'>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  /** 템플릿 버튼: 내용이 비어 있으면 대체, 있으면 줄바꿈 후 append. */
  const applyTemplate = (t: InquiryTemplate) => {
    setContent((prev) =>
      prev.trim().length === 0 ? t.content : `${prev}\n\n${t.content}`.slice(0, MAX_CONTENT),
    );
  };

  const toggleContact = (key: 'email' | 'sms') => {
    setContacts((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const sectionCls = 'flex flex-col gap-6 rounded-xl bg-white p-6 sm:p-8';
  const labelCls = 'flex items-center gap-0.5 text-base text-[#1A1C20]';

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-8">
      <h1 className="text-center text-3xl font-bold text-[#1A1C20] sm:text-[36px]">문의하기</h1>

      {/* ① 문제분류 */}
      <section className={sectionCls}>
        <h2 className="text-xl font-bold text-black">문제분류</h2>

        <div className="flex flex-col gap-2 px-0.5">
          <span className={labelCls}>
            문의 프로그램 <Required />
          </span>
          <div className="flex flex-wrap gap-2">
            {PROGRAMS.map((p) => (
              <Chip key={p} label={p} selected={program === p} onClick={() => setProgram(p)} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 px-0.5">
          <span className={labelCls}>
            상세 유형 <Required />
          </span>
          <div className="flex flex-wrap gap-2">
            {DETAIL_TYPES.map((d) => (
              <Chip
                key={d}
                label={d}
                selected={detailType === d}
                onClick={() => setDetailType(d)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ② 상세 내용 */}
      <section className={sectionCls}>
        <h2 className="text-xl font-bold text-black">상세 내용</h2>

        <div className="flex flex-col gap-2 px-0.5">
          <span className={labelCls}>
            제목 <Required />
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목을 입력해주세요"
            className="h-[52px] w-full rounded-lg border border-[#DCDEE3] px-4 text-base text-[#1A1C20] placeholder:text-[#B0B3BA] focus:border-[#00A36B] focus:outline-none"
          />
        </div>

        <div className="flex flex-col gap-2 px-0.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={labelCls}>
              상세 내용 <Required />
            </span>
            {templates.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    title={`'${t.title}' 템플릿 채우기`}
                    className="inline-flex items-center rounded-md border border-[#DCDEE3] bg-white px-2.5 py-1 text-xs font-medium text-[#555D6D] transition-colors hover:border-[#00A36B] hover:bg-[#E6F7F0] hover:text-[#00A36B]"
                  >
                    {t.title}
                  </button>
                ))}
              </div>
            )}
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
            placeholder="상세내용을 입력해 주세요"
            className="h-[320px] w-full resize-none rounded-lg border border-[#DCDEE3] p-4 text-base leading-relaxed text-[#1A1C20] placeholder:text-[#B0B3BA] focus:border-[#00A36B] focus:outline-none"
          />
          <span className="self-end text-sm text-[#868B94]">
            {content.length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}
          </span>
        </div>

        <div className="flex flex-col gap-2 px-0.5">
          <span className={labelCls}>첨부 파일</span>
          <label className="flex h-[140px] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border border-dashed border-[#DCDEE3] bg-[#F7F8F9] px-4 text-center transition-colors hover:border-[#00A36B]">
            <input type="file" multiple className="hidden" />
            <Paperclip className="h-8 w-8 text-[#868B94]" />
            <span className="text-base font-semibold text-[#1A1C20]">
              파일을 끌어놓거나 클릭하여 선택
            </span>
            <span className="text-sm text-[#868B94]">
              이미지 · 비디오 · PDF · ZIP · 로그 (개당 최대 50MB, 총 200MB)
            </span>
          </label>
        </div>
      </section>

      {/* ③ 연락 방법 */}
      <section className={sectionCls}>
        <h2 className="text-xl font-bold text-black">연락 방법</h2>

        <div className="flex flex-col gap-2">
          <span className={`${labelCls} px-1`}>
            발송 방법 <Required />
          </span>
          <div className="flex flex-col gap-4 sm:flex-row">
            <ContactOption
              Icon={Mail}
              label="이메일"
              value="oahotel@oapms.com"
              selected={contacts.has('email')}
              onClick={() => toggleContact('email')}
            />
            <ContactOption
              Icon={MessageSquareText}
              label="SMS"
              value="010-1234-4567"
              selected={contacts.has('sms')}
              onClick={() => toggleContact('sms')}
            />
          </div>
          <span className="text-sm text-[#868B94]">최소 한 가지 연락 방법을 선택해주세요.</span>
        </div>
      </section>

      {/* 접수하기 */}
      <button
        type="button"
        onClick={() => setSubmitted(true)}
        className="w-full rounded-lg bg-[#00A36B] py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#008A59]"
      >
        접수하기
      </button>

      {/* 접수 완료 모달 */}
      {submitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="flex w-full max-w-[460px] flex-col gap-6 rounded-2xl bg-white p-8 shadow-[0px_2px_10px_0px_rgba(0,0,0,0.1)]">
            <div className="flex flex-col items-center gap-2 text-center">
              <h3 className="text-lg font-bold text-[#1A1C20]">문의가 접수되었어요</h3>
              <p className="text-base text-[#555D6D]">빠른 시간 내에 답변드리겠습니다.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/landing/tickets"
                className="flex-1 rounded-lg bg-[#E6F7F0] py-3.5 text-center text-base font-semibold text-[#00A36B] transition-colors hover:bg-[#d2f0e4]"
              >
                내 문의 목록
              </Link>
              <Link
                href="/landing/home"
                className="flex-1 rounded-lg bg-[#F3F4F5] py-3.5 text-center text-base font-semibold text-[#1A1C20] transition-colors hover:bg-[#e9eaec]"
              >
                홈으로
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContactOption({
  Icon,
  label,
  value,
  selected,
  onClick,
}: {
  Icon: typeof Mail;
  label: string;
  value: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex flex-1 items-center gap-3 rounded-lg border px-5 py-3.5 text-left transition-colors ${
        selected ? 'border-[#00A36B] bg-[#E6F7F0]' : 'border-black/[0.06] bg-white hover:bg-[#F7F8F9]'
      }`}
    >
      <Icon className={`h-6 w-6 shrink-0 ${selected ? 'text-[#00A36B]' : 'text-[#868B94]'}`} />
      <span className="flex flex-1 flex-col">
        <span className="text-base font-medium text-[#1A1C20]">{label}</span>
        <span className="text-xs text-[#555D6D]">{value}</span>
      </span>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
          selected ? 'border-[#00A36B] bg-[#00A36B]' : 'border-[#DCDEE3]'
        }`}
      >
        {selected && <Check className="h-3.5 w-3.5 text-white" />}
      </span>
    </button>
  );
}
