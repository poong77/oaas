'use client';

/**
 * TicketDetailView — 문의 상세 시안 (상태별: 접수/처리중/답변 보류/답변 완료).
 *
 * 좌: 문의 상세(상세 내용·첨부·추가 내용) + 답변 내역
 * 우: 진행 스테퍼(접수→처리중/보류→답변 완료) + 문의 메타 카드
 * 보류 상태: 추가 정보 안내 배너 + '정보 추가하기' → 추가 정보 입력 모달.
 *
 * 상태는 ?status=received|progress|hold|done 로 미리보기. 시안용 정적 데이터.
 */

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Paperclip, FileText, AlertCircle } from 'lucide-react';

export type TicketStatus = 'received' | 'progress' | 'hold' | 'done';

const TICKET_NO = 'AS-20260103-027';
const MAX_CONTENT = 20000;

const DETAIL_CONTENT = `발생 시간: 2026-01-03 23:50경 (야간 마감 시도 중)

발생 화면: PMS > 야간감사(일마감)

증상: [일마감] 실행 후 "처리 중"에서 멈추고 마감이 완료되지 않습니다. 영업일이 다음 날짜로 넘어가지 않아 신규 예약 등록이 막힌 상태입니다.

시도해본 조치: PMS 재실행, 프런트 PC 재부팅 — 동일 증상 반복`;

const REPLY = `안녕하세요, 김오아님.
문의 주신 일마감(야간감사) 미완료 현상은, 마감 직전 등록된 일부 예약의 데이터 정합성 오류로 마감 처리가 중단된 것이 원인으로 확인되었습니다.
해당 데이터를 정리한 뒤 2026-01-03 영업일 마감을 정상 처리했으며, 현재는 일마감이 정상 완료됩니다.
동일 현상 방지 위한 패치도 적용했습니다.
추가로 궁금하신 점이 있으시면 본 문의에 이어서 남겨 주세요. 감사합니다.`;

/** 상태별 스테퍼 단계 (라벨·일시). */
function buildSteps(status: TicketStatus) {
  const midLabel = status === 'hold' ? '답변 보류' : '처리중';
  const dates: Record<TicketStatus, [string, string, string]> = {
    received: ['2026-01-03', '대기', '대기'],
    progress: ['2026-01-03 12:00', '2026-01-03 16:12', '대기'],
    hold: ['2026-01-03 12:00', '2026-01-03 16:12', '대기'],
    done: ['2026-01-03 12:00', '2026-01-03 16:12', '2026-01-04 11:12'],
  };
  return [
    { label: '접수', date: dates[status][0] },
    { label: midLabel, date: dates[status][1] },
    { label: '답변 완료', date: dates[status][2] },
  ];
}

const CURRENT_INDEX: Record<TicketStatus, number> = {
  received: 0,
  progress: 1,
  hold: 1,
  done: 2,
};

const ACTIVE_COLOR: Record<TicketStatus, string> = {
  received: 'bg-[#217CF9]',
  progress: 'bg-[#8969EA]',
  hold: 'bg-[#D9A411]',
  done: 'bg-[#00A36B]',
};

function AttachmentChip({ name, size = '97kb' }: { name: string; size?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-[#DCDEE3] bg-white px-3 py-2 text-sm">
      <FileText className="h-4 w-4 text-[#00A36B]" />
      <span className="font-medium text-[#1A1C20]">{name}</span>
      <span className="text-[#868B94]">{size}</span>
    </span>
  );
}

export function TicketDetailView({ status }: { status: TicketStatus }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [extra, setExtra] = useState('');

  const steps = buildSteps(status);
  const currentIndex = CURRENT_INDEX[status];

  return (
    <div className="mx-auto w-full max-w-[1200px]">
      {/* 상단 */}
      <Link
        href="/landing/tickets"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#555D6D] hover:text-[#00A36B]"
      >
        <ArrowLeft className="h-4 w-4" />
        내 문의로
      </Link>
      <p className="text-sm text-[#868B94]">{TICKET_NO}</p>
      <h1 className="mb-6 text-3xl font-bold text-[#1A1C20]">일마감이 안돼요</h1>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 좌측 본문 */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* 문의 상세 */}
          <section className="flex flex-col gap-5 rounded-xl border border-black/[0.06] bg-white p-6">
            <h2 className="text-base font-bold text-[#1A1C20]">문의 상세</h2>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#555D6D]">상세 내용</span>
              <pre className="whitespace-pre-wrap rounded-lg bg-[#F7F8F9] p-4 font-sans text-sm leading-relaxed text-[#1A1C20]">
                {DETAIL_CONTENT}
              </pre>
            </div>

            {status === 'done' && (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-[#555D6D]">추가 내용</span>
                <pre className="whitespace-pre-wrap rounded-lg bg-[#F7F8F9] p-4 font-sans text-sm leading-relaxed text-[#1A1C20]">
                  {`예약번호: OA-260103-0451\n관련 로그: nightaudit_0103.log (첨부)`}
                </pre>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#555D6D]">첨부 파일</span>
              <div className="flex flex-wrap gap-2">
                <AttachmentChip name="파일명.jpg" />
                <AttachmentChip name="파일명.jpg" />
                {status === 'done' && <AttachmentChip name="nightaudit_0103.log" />}
              </div>
            </div>

            {/* 보류 안내 배너 */}
            {status === 'hold' && (
              <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-[#F0D78A] bg-[#FEF7E6] p-4 sm:flex-row sm:items-center">
                <div className="flex gap-2">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#C2890E]" />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-[#1A1C20]">
                      추가 정보 확인이 필요해 보류중입니다.
                    </span>
                    <span className="text-sm text-[#876A1A]">
                      발생시점의 예약번호와 로그를 알려주세요
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="shrink-0 rounded-lg bg-[#D9A411] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#c2920c]"
                >
                  정보 추가하기
                </button>
              </div>
            )}
          </section>

          {/* 답변 내역 */}
          <section className="flex flex-col gap-4 rounded-xl border border-black/[0.06] bg-white p-6">
            <h2 className="text-base font-bold text-[#1A1C20]">답변 내역</h2>
            {status === 'done' ? (
              <div className="flex flex-col gap-3 rounded-lg bg-[#F7F8F9] p-5">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-[#1A1C20]">
                  {REPLY}
                </pre>
                <span className="self-end text-xs text-[#868B94]">담당자명 · 2026-06-08 15:05:35</span>
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-[#F7F8F9] py-16 text-sm text-[#868B94]">
                아직 답변이 없습니다.
              </div>
            )}
          </section>
        </div>

        {/* 우측 사이드바 */}
        <aside className="flex shrink-0 flex-col gap-4 lg:w-[300px]">
          {/* 진행 스테퍼 */}
          <div className="rounded-xl border border-black/[0.06] bg-white p-6">
            <ol className="flex flex-col">
              {steps.map((step, i) => {
                const done = i < currentIndex;
                const active = i === currentIndex;
                const last = i === steps.length - 1;
                return (
                  <li key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
                          done
                            ? 'bg-[#00A36B]'
                            : active
                              ? ACTIVE_COLOR[status]
                              : 'bg-[#DCDEE3]'
                        }`}
                      >
                        {done ? <Check className="h-4 w-4" /> : i + 1}
                      </span>
                      {!last && (
                        <span
                          className={`my-1 w-px flex-1 ${done ? 'bg-[#00A36B]' : 'bg-[#DCDEE3]'}`}
                        />
                      )}
                    </div>
                    <div className={`flex flex-col pb-6 ${last ? 'pb-0' : ''}`}>
                      <span
                        className={`text-sm font-semibold ${
                          done || active ? 'text-[#1A1C20]' : 'text-[#B0B3BA]'
                        }`}
                      >
                        {step.label}
                      </span>
                      <span className="text-xs text-[#868B94]">{step.date}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* 메타 정보 */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-xl border border-black/[0.06] bg-white p-6">
            <Meta label="문의 프로그램" value="PMS" />
            <Meta label="유형" value="시스템 장애" />
            <Meta label="접수자" value="김오아" />
            <Meta label="호텔" value="오아 호텔" />
            <Meta label="긴급도" value="P2" />
            <Meta label="담당자" value={status === 'received' ? '-' : '김오아'} />
          </div>
        </aside>
      </div>

      {/* 추가 정보 입력 모달 */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="flex w-full max-w-[420px] flex-col gap-5 rounded-2xl bg-white p-7 shadow-[0px_2px_10px_0px_rgba(0,0,0,0.1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-center text-lg font-bold text-[#1A1C20]">추가 정보 입력</h3>

            <div className="flex gap-2 rounded-lg bg-[#F7F8F9] p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#C2890E]" />
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-[#1A1C20]">
                  추가 정보 확인이 필요해 보류중입니다.
                </span>
                <span className="text-sm text-[#555D6D]">발생시점의 예약번호와 로그를 알려주세요</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-0.5 text-sm font-medium text-[#1A1C20]">
                추가 정보 입력 <span className="text-[#FA342C]">*</span>
              </span>
              <textarea
                value={extra}
                onChange={(e) => setExtra(e.target.value.slice(0, MAX_CONTENT))}
                placeholder="담당자가 요청한 정보를 입력해 주세요."
                className="h-[160px] w-full resize-none rounded-lg border border-[#DCDEE3] p-4 text-base text-[#1A1C20] placeholder:text-[#B0B3BA] focus:border-[#00A36B] focus:outline-none"
              />
              <span className="self-end text-sm text-[#868B94]">
                {extra.length.toLocaleString()} / {MAX_CONTENT.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-[#1A1C20]">첨부 파일</span>
              <label className="flex h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#DCDEE3] bg-[#F7F8F9] px-4 text-center transition-colors hover:border-[#00A36B]">
                <input type="file" multiple className="hidden" />
                <Paperclip className="h-6 w-6 text-[#868B94]" />
                <span className="text-sm font-semibold text-[#1A1C20]">
                  파일을 끌어놓거나 클릭하여 선택
                </span>
                <span className="text-xs text-[#868B94]">
                  이미지 · 비디오 · PDF · ZIP · 로그 (개당 최대 50MB, 총 200MB)
                </span>
              </label>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="w-full rounded-lg bg-[#2A3038] py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#1f242a]"
            >
              제출하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-[#868B94]">{label}</span>
      <span className="text-sm font-medium text-[#1A1C20]">{value}</span>
    </div>
  );
}
