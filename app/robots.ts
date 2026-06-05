import type { MetadataRoute } from 'next';

/**
 * 전체 크롤링 차단.
 *
 * 통합 AS는 로그인 기반 비공개 서비스(랜딩 외 전 페이지 인증 필요)이므로
 * 검색 엔진 색인이 필요 없다. 모든 경로를 Disallow 한다.
 * (root layout의 robots 메타 noindex + next.config의 X-Robots-Tag 헤더와 이중·삼중 방어)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
