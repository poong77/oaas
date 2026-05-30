/**
 * Zod 스키마 — articles 저장 검증.
 *
 * 결정 반영:
 *   - Q-3: content_type 영문 코드 enum
 *   - Q-12: applies_to nullable JSONB
 *   - Q-14: relatedSlugs (text[])
 *   - D-4: summary 2000자 hard limit, 200자 권장 워닝 (body-validator)
 *   - D-5: applies_to.feature 자유 텍스트 (마스터 없음)
 *
 * @see docs/02-design/features/아티클관리시스템.design.md §6.1
 */

import { z } from 'zod';
import { SLUG_PATTERN } from './slug';

const CONTENT_TYPES = ['howto', 'feature', 'troubleshoot'] as const;

export const articleAppliesToSchema = z
  .object({
    feature: z.string().trim().min(1).max(80).optional(),
    models: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  })
  .strict()
  .nullable();

export const articleSaveSchema = z.object({
  productCode: z.string().trim().min(1).max(40),
  contentType: z.enum(CONTENT_TYPES),
  slug: z
    .string()
    .trim()
    .regex(SLUG_PATTERN, '소문자/숫자/하이픈만 사용 가능합니다')
    .min(2)
    .max(100),
  title: z.string().trim().min(1, '제목을 입력하세요').max(60, '60자 이내'),
  summary: z
    .string()
    .trim()
    .max(2000, '요약은 2000자 이내')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  menuPath: z
    .array(z.string().trim().min(1).max(60))
    .min(1, '메뉴 경로는 최소 1단계 필요합니다')
    .max(3, '메뉴 경로는 최대 3단계까지'),
  keywords: z
    .array(z.string().trim().min(1).max(60))
    .min(1, '키워드는 최소 1개 필요합니다')
    .max(30, '키워드는 최대 30개'),
  appliesTo: articleAppliesToSchema.optional(),
  bodyMarkdown: z.string().min(1, '본문을 입력하세요'),
  relatedSlugs: z
    .array(z.string().regex(SLUG_PATTERN))
    .max(30)
    .default([]),
});

export type ArticleSaveInput = z.infer<typeof articleSaveSchema>;

/** content_type 한글 라벨 매핑 (Q-3). */
export const CONTENT_TYPE_LABEL: Record<
  (typeof CONTENT_TYPES)[number],
  string
> = {
  howto: '사용방법',
  feature: '기능설명',
  troubleshoot: '문제해결',
};

/** 상태 한글 라벨. */
export const STATUS_LABEL = {
  draft: '초안',
  published: '발행됨',
} as const;
