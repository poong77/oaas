/**
 * 사용자 의도(content_type) 3타입 표시 메타 — label·tone·hint 단일 출처.
 *
 * intent-selector(편집기 카드)와 아티클 리스트 칩 등에서 공용으로 사용한다.
 * @see db/schema/articles.ts articleContentTypeEnum
 */

import type { ArticleContentType } from '@/db/schema';

export type ContentTypeTone = 'brand' | 'success' | 'warn';

export const CONTENT_TYPE_META: Record<
  ArticleContentType,
  { label: string; hint: string; tone: ContentTypeTone }
> = {
  howto: { label: '사용방법', hint: '따라하기', tone: 'brand' },
  feature: { label: '기능설명', hint: '이해하기', tone: 'success' },
  troubleshoot: { label: '문제해결', hint: '고치기', tone: 'warn' },
};

/** 셀렉터 카드 등 순서가 필요한 곳에서 사용하는 정렬된 옵션 목록. */
export const CONTENT_TYPE_OPTIONS: Array<
  { value: ArticleContentType } & (typeof CONTENT_TYPE_META)[ArticleContentType]
> = (
  ['howto', 'feature', 'troubleshoot'] as ArticleContentType[]
).map((value) => ({ value, ...CONTENT_TYPE_META[value] }));
