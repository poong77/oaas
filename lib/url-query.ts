/**
 * URLSearchParams 직렬화 보정 + 카테고리 path 직렬화 헬퍼.
 *
 * `URLSearchParams.toString()`은 공백을 form-urlencoded 방식(`+`)으로 인코딩한다.
 * 그러나 Next.js App Router의 서버 `searchParams` prop은 `+`를 공백으로 디코딩하지
 * 않고 리터럴 `+`로 전달한다(퍼센트 디코딩만 수행). 결과적으로
 *   ?path=객실재고+(타입별)
 * 가 서버에서 `객실재고+(타입별)`(리터럴 +)로 들어와, DB에 저장된 `객실재고 (타입별)`
 * (공백)과 배열 매칭이 깨진다. `+` → `%20`으로 치환하면 클라이언트(URLSearchParams)와
 * 서버(Next) 양쪽 모두 동일하게 공백으로 디코딩하므로 왕복이 안전해진다.
 */
export function toQueryString(params: URLSearchParams): string {
  return params.toString().replace(/\+/g, '%20');
}

/**
 * 카테고리 path를 내부 맵 키/선택 비교용 문자열로 직렬화한다.
 *
 * URL에는 노출되지 않는 내부 키이므로, 라벨에 등장하지 않을 제어문자(US, U+001F)를
 * 구분자로 사용한다. `'/'`를 쓰면 `체크인/아웃`처럼 라벨 자체에 `/`가 있는 경우
 * 키가 충돌(`A/B/C`가 `[A,B,C]`인지 `[A/B,C]`인지 모호)할 수 있어 이를 차단한다.
 * (URL path 자체는 배열 파라미터 `?path=A&path=B`로 전달하므로 구분자가 없다.)
 */
export const PATH_KEY_SEPARATOR = '\u001f';

export function pathToKey(parts: string[]): string {
  return parts.join(PATH_KEY_SEPARATOR);
}

/**
 * Next App Router의 `searchParams.path`(string | string[] | undefined)를
 * 정규화된 string[]로 변환한다. 단일 값/배열/누락을 모두 처리하고, 혹시 섞여 들어온
 * form-urlencoded `'+'`는 공백으로 복원한다(라벨에 리터럴 `+`는 없으므로 안전).
 */
export function parsePathParam(raw: string | string[] | undefined): string[] {
  const arr = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  return arr.map((s) => s.replace(/\+/g, ' ').trim()).filter(Boolean);
}
