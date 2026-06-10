/**
 * CB-05 — 지식팩 포맷 (순수 함수, IO 없음).
 *
 * DB·server-only·next/cache 의존이 전혀 없는 순수 모듈.
 * → Next 런타임(서버 컴포넌트/route)과 tsx 스크립트(db/export-knowledge.ts)가 공유.
 *
 * 타입 정의 + 본문 정규화 + Markdown/JSONL 빌더만 담당한다.
 * 실제 데이터 로드(buildKnowledgePack)는 server-only인 knowledge-export.ts.
 *
 * @see docs/IMPLEMENTATION_PLAN.md §2-b CB-05
 */

import type { ArticleContentType, TermGroupCategory } from '@/db/schema';

// ─────────────────────────────────────────────────────────────────────
// 상수 / 라벨 매핑
// ─────────────────────────────────────────────────────────────────────

export const PUBLIC_BASE_URL = 'https://support.oapms.com';

export const CONTENT_TYPE_LABEL: Record<ArticleContentType, string> = {
  howto: '사용방법',
  feature: '기능설명',
  troubleshoot: '문제해결',
};

export const TERM_CATEGORY_LABEL: Record<TermGroupCategory, string> = {
  operation: '운영',
  housekeeping: '청소',
  fnb: '식음료',
  frontdesk: '프런트',
  pms: 'PMS 용어',
  product: 'OA 제품',
  issue: '장애 유형',
  role: '직무',
  misc: '기타',
};

// ─────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────

export type ArticleKnowledge = {
  id: string;
  slug: string;
  productCode: string;
  productLabel: string;
  contentType: ArticleContentType;
  contentTypeLabel: string;
  categoryPath: string[];
  appliesToFeature: string | null;
  keywords: string[];
  title: string;
  summary: string | null;
  url: string;
  /** 정규화된 본문 markdown. */
  content: string;
};

export type FaqKnowledge = {
  id: string;
  productCode: string;
  productLabel: string;
  issueType: string | null;
  keywords: string[];
  question: string;
  /** 정규화된 답변 markdown. */
  answer: string;
};

export type SynonymKnowledge = {
  canonical: string;
  category: TermGroupCategory;
  categoryLabel: string;
  variants: string[];
};

export type KnowledgePack = {
  generatedAt: Date;
  productCode: string | null;
  productLabel: string | null;
  synonyms: SynonymKnowledge[];
  articles: ArticleKnowledge[];
  faqs: FaqKnowledge[];
  stats: {
    articleCount: number;
    faqCount: number;
    synonymGroupCount: number;
    synonymTermCount: number;
  };
};

// ─────────────────────────────────────────────────────────────────────
// 본문 정규화 — 인라인 HTML 노이즈 제거 (경량 regex 패스)
// ─────────────────────────────────────────────────────────────────────

/**
 * body_markdown / answer_markdown 정규화.
 *
 * Tiptap Option A(html:true)로 저장된 "markdown + 인라인 HTML hybrid"에서
 * AI 인식을 방해하는 노이즈를 제거한다. 무거운 HTML 파서 없이 결정론적 regex 사용.
 *
 *   - HTML 주석 제거
 *   - <img>            → [이미지: alt]  (시각 정보를 텍스트로 보존)
 *   - <br>             → 개행
 *   - <p>/<div> 닫힘   → 문단 구분 개행
 *   - 스타일 전용 태그(span/div/font/section/article 등) 언랩 (텍스트 유지)
 *   - 잔여 HTML 태그   → 제거 (markdown 강조 표기는 그대로 남음)
 *   - HTML 엔티티 일부 디코드, 과다 공백/개행 축소
 */
export function normalizeBody(input: string): string {
  if (!input) return '';
  let s = input;

  // HTML 주석
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  // 이미지 → alt 텍스트
  s = s.replace(/<img\b[^>]*?>/gi, (tag) => {
    const alt = /\balt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.trim();
    return alt ? `[이미지: ${alt}]` : '[이미지]';
  });

  // 줄바꿈/문단 태그 → 개행
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|section|article|li|h[1-6])\s*>/gi, '\n');

  // 스타일/구조 전용 여는 태그 언랩 (콘텐츠 유지)
  s = s.replace(/<\/?(span|div|font|section|article|small|mark)\b[^>]*>/gi, '');

  // 잔여 모든 HTML 태그 제거 (markdown 표기는 영향 없음)
  s = s.replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, '');

  // 기본 엔티티 디코드
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // 공백/개행 정리
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return s;
}

// ─────────────────────────────────────────────────────────────────────
// 빌더 — Markdown
// ─────────────────────────────────────────────────────────────────────

function formatDateKst(date: Date): string {
  // KST(UTC+9) 기준 YYYY-MM-DD
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

const AI_PREAMBLE = [
  '## AI 사용 지침',
  '',
  '- 아래 "지식"에 명시된 내용만 근거로 답하라. 추측·일반지식 사용을 금지한다.',
  '- 사용자의 구어체·약어는 아래 "용어 사전"으로 표준어에 매핑해 질문을 해석하라.',
  '- 지식에서 답을 찾지 못하면 임의로 지어내지 말고, "이슈 접수"를 안내하라.',
  '- 답변 끝에 근거 출처를 `[slug]`(아티클) 또는 `[FAQ]` 형태로 표기하라.',
  '- 한국어로, 호텔 현장 담당자가 바로 따라할 수 있게 단계적으로 답하라.',
].join('\n');

/** KnowledgePack → 단일 Markdown 문서 (사람 검수 + AI 입력 겸용). */
export function toMarkdown(pack: KnowledgePack): string {
  const out: string[] = [];
  const scopeLabel = pack.productLabel
    ? `${pack.productLabel} (${pack.productCode})`
    : '전체 제품';

  // 헤더
  out.push('# OA서포트 지식베이스 — AI 지식팩');
  out.push('');
  out.push(`> 생성: ${formatDateKst(pack.generatedAt)} (KST)`);
  out.push(`> 범위: ${scopeLabel}`);
  out.push(
    `> 구성: 발행 아티클 ${pack.stats.articleCount}건 · 활성 FAQ ${pack.stats.faqCount}건 · 동의어 그룹 ${pack.stats.synonymGroupCount}건(이형어 ${pack.stats.synonymTermCount}개)`,
  );
  out.push('');
  out.push(AI_PREAMBLE);
  out.push('');
  out.push('---');
  out.push('');

  // 1. 용어 사전
  out.push('## 1. 용어 사전 (구어체 → 표준어)');
  out.push('');
  out.push(
    '> 사용자가 쓰는 다양한 표현을 표준어로 매핑한다. 질문 해석에 활용한다.',
  );
  out.push('');
  if (pack.synonyms.length === 0) {
    out.push('_(등록된 동의어 없음)_');
    out.push('');
  } else {
    // 카테고리별 그룹핑
    const byCategory = new Map<string, SynonymKnowledge[]>();
    for (const s of pack.synonyms) {
      const arr = byCategory.get(s.categoryLabel) ?? [];
      arr.push(s);
      byCategory.set(s.categoryLabel, arr);
    }
    for (const [catLabel, items] of byCategory) {
      out.push(`### ${catLabel}`);
      out.push('');
      for (const s of items) {
        const variants =
          s.variants.length > 0 ? ` ← ${s.variants.join(', ')}` : '';
        out.push(`- **${s.canonical}**${variants}`);
      }
      out.push('');
    }
  }
  out.push('---');
  out.push('');

  // 2. 도움말 아티클 (제품별)
  out.push('## 2. 도움말 아티클 (발행본)');
  out.push('');
  if (pack.articles.length === 0) {
    out.push('_(발행된 아티클 없음)_');
    out.push('');
  } else {
    const byProduct = groupByProduct(pack.articles);
    for (const [productLabel, items] of byProduct) {
      out.push(`### ${productLabel}`);
      out.push('');
      for (const a of items) {
        out.push(`#### [${a.slug}] ${a.title}`);
        out.push('');
        const meta: string[] = [`유형 ${a.contentTypeLabel}`];
        if (a.categoryPath.length > 0)
          meta.push(`카테고리 ${a.categoryPath.join(' › ')}`);
        if (a.appliesToFeature) meta.push(`적용 ${a.appliesToFeature}`);
        if (a.keywords.length > 0) meta.push(`검색어 ${a.keywords.join(', ')}`);
        out.push(`- ${meta.join(' · ')}`);
        out.push(`- 출처: ${a.url}`);
        out.push('');
        if (a.summary?.trim()) {
          out.push(`> ${a.summary.trim()}`);
          out.push('');
        }
        out.push(a.content || '_(본문 없음)_');
        out.push('');
        out.push('---');
        out.push('');
      }
    }
  }

  // 3. FAQ (제품별)
  out.push('## 3. 자주 묻는 질문 (FAQ)');
  out.push('');
  if (pack.faqs.length === 0) {
    out.push('_(등록된 FAQ 없음)_');
    out.push('');
  } else {
    const byProduct = groupByProduct(pack.faqs);
    for (const [productLabel, items] of byProduct) {
      out.push(`### ${productLabel}`);
      out.push('');
      for (const f of items) {
        out.push(`#### Q. ${f.question}  [FAQ]`);
        out.push('');
        if (f.keywords.length > 0) {
          out.push(`- 검색어 ${f.keywords.join(', ')}`);
          out.push('');
        }
        out.push(`A. ${f.answer || '_(답변 없음)_'}`);
        out.push('');
      }
    }
  }

  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  );
}

function groupByProduct<T extends { productLabel: string }>(
  items: T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const it of items) {
    const arr = map.get(it.productLabel) ?? [];
    arr.push(it);
    map.set(it.productLabel, arr);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────
// 빌더 — JSONL
// ─────────────────────────────────────────────────────────────────────

/**
 * KnowledgePack → JSONL (1행 1레코드).
 *
 * 순서: synonym → article → faq. RAG/Assistants file_search/임베딩 재활용에 최적.
 */
export function toJsonl(pack: KnowledgePack): string {
  const lines: string[] = [];

  for (const s of pack.synonyms) {
    lines.push(
      JSON.stringify({
        type: 'synonym',
        canonical: s.canonical,
        category: s.category,
        variants: s.variants,
      }),
    );
  }

  for (const a of pack.articles) {
    lines.push(
      JSON.stringify({
        type: 'article',
        id: a.id,
        slug: a.slug,
        product: a.productCode,
        productLabel: a.productLabel,
        contentType: a.contentType,
        category: a.categoryPath,
        appliesTo: a.appliesToFeature,
        keywords: a.keywords,
        title: a.title,
        summary: a.summary,
        url: a.url,
        content: a.content,
      }),
    );
  }

  for (const f of pack.faqs) {
    lines.push(
      JSON.stringify({
        type: 'faq',
        id: f.id,
        product: f.productCode,
        productLabel: f.productLabel,
        issueType: f.issueType,
        keywords: f.keywords,
        question: f.question,
        answer: f.answer,
      }),
    );
  }

  return lines.join('\n') + (lines.length > 0 ? '\n' : '');
}
