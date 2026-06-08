/**
 * Raw MIME 이메일 빌더 — CID 인라인 이미지 첨부용.
 *
 * SESv2 SendEmailCommand의 Simple 콘텐츠는 인라인 첨부를 지원하지 않으므로,
 * 인라인 이미지가 있을 때는 직접 multipart MIME을 구성해 `Content.Raw.Data`로 보낸다.
 *
 * 구조:
 *   multipart/related            ← 본문 + 인라인 이미지 묶음
 *   ├─ multipart/alternative     ← (text 있을 때) text + html 대체본
 *   │  ├─ text/plain
 *   │  └─ text/html
 *   └─ image/*  (Content-ID, inline)  × N
 *   ※ text가 없으면 alternative 없이 text/html 단일 파트.
 *
 * 인코딩:
 *   - 본문/이미지 모두 base64 (Content-Transfer-Encoding: base64), 76자 줄바꿈(CRLF).
 *   - 헤더(제목 등) 비ASCII는 RFC 2047 (`=?UTF-8?B?...?=`) 인코딩, 75자 이하로 분할.
 *   - 줄바꿈은 전부 CRLF (MIME 규약).
 */

import type { InlineImage } from '@/lib/notifications/email-images';

const CRLF = '\r\n';

/** base64 인코딩 + 76자 줄바꿈(CRLF). */
function base64Wrapped(data: Uint8Array | string): string {
  const buf =
    typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data);
  const b64 = buf.toString('base64');
  const lines: string[] = [];
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  return lines.join(CRLF);
}

/** RFC 2047 헤더 인코딩. 순수 printable-ASCII면 그대로, 아니면 인코딩 워드로 분할. */
function encodeHeader(value: string): string {
  if (/^[\x20-\x7E]*$/.test(value)) return value;
  // 인코딩 워드 1개 ≤ 75자. 오버헤드 `=?UTF-8?B??=` = 12자 → base64 ≤ 63자
  // → 원본 UTF-8 ≤ 45바이트. 멀티바이트 문자가 잘리지 않도록 코드포인트 단위로 누적.
  const words: string[] = [];
  let chunk = Buffer.alloc(0);
  for (const ch of value) {
    const b = Buffer.from(ch, 'utf8');
    if (chunk.length + b.length > 45) {
      words.push(`=?UTF-8?B?${chunk.toString('base64')}?=`);
      chunk = Buffer.alloc(0);
    }
    chunk = Buffer.concat([chunk, b]);
  }
  if (chunk.length) words.push(`=?UTF-8?B?${chunk.toString('base64')}?=`);
  // 폴딩: 인코딩 워드 사이는 CRLF + SP
  return words.join(`${CRLF} `);
}

export type RawEmailInput = {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text?: string;
  images: InlineImage[];
};

/**
 * 인라인 이미지를 포함한 raw MIME 메시지를 생성한다.
 * @returns SESv2 `Content.Raw.Data`에 넣을 바이트(Uint8Array).
 */
export function buildRawEmail(input: RawEmailInput): Uint8Array {
  // 본문 콘텐츠가 본문에 우연히 나타나도 깨지지 않도록 충분히 고유한 경계 문자열.
  // (base64에는 `_`/`=` 조합 + 이 prefix가 등장하지 않는다)
  const relBoundary = `----=_OAAS_REL_${input.images.length}_${input.html.length}`;
  const altBoundary = `----=_OAAS_ALT_${input.images.length}_${input.html.length}`;

  const htmlPart = [
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    base64Wrapped(input.html),
  ].join(CRLF);

  // related의 첫 자식: text 있으면 multipart/alternative, 없으면 html 단일 파트
  let bodyEntity: string;
  if (input.text && input.text.trim().length > 0) {
    const textPart = [
      `Content-Type: text/plain; charset=UTF-8`,
      `Content-Transfer-Encoding: base64`,
      ``,
      base64Wrapped(input.text),
    ].join(CRLF);
    bodyEntity = [
      `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
      ``,
      `--${altBoundary}`,
      textPart,
      `--${altBoundary}`,
      htmlPart,
      `--${altBoundary}--`,
    ].join(CRLF);
  } else {
    bodyEntity = htmlPart;
  }

  const imageParts = input.images.map((img) =>
    [
      `Content-Type: ${img.contentType}; name="${img.filename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-ID: <${img.cid}>`,
      `Content-Disposition: inline; filename="${img.filename}"`,
      ``,
      base64Wrapped(img.content),
    ].join(CRLF),
  );

  const headers = [
    `From: ${input.from}`,
    `To: ${input.to.join(', ')}`,
    `Subject: ${encodeHeader(input.subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/related; boundary="${relBoundary}"`,
  ].join(CRLF);

  const message = [
    headers,
    ``,
    `--${relBoundary}`,
    bodyEntity,
    ...imageParts.map((p) => `--${relBoundary}${CRLF}${p}`),
    `--${relBoundary}--`,
    ``,
  ].join(CRLF);

  return new Uint8Array(Buffer.from(message, 'utf8'));
}
