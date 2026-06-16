/**
 * S3 공유 헬퍼 — 업로드(PutObject)와 인증 프록시 다운로드(GetObject)에서 공용.
 *
 * 버킷(`oaas-uploads-prd`)은 **비공개**다. 원본 S3 URL을 그대로 링크하면 AccessDenied.
 * 첨부 조회는 반드시 `/api/attachments/[id]` 인증 프록시를 통한다.
 *
 * - `getS3Client()` : 자격증명(있으면)으로 구성된 싱글턴 클라이언트.
 * - `resolveS3Object()` : 첨부 메타(pathname/blobUrl)에서 { bucket, key } 도출.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { env } from '@/lib/env';

let s3ClientSingleton: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3ClientSingleton) {
    // S3는 EC2 IAM Role(`oaas-IAM-role-ec2-prd`)을 사용한다.
    // credentials 옵션을 지정하지 않으면 SDK default provider chain이
    // 인스턴스 메타데이터(IAM Role)로 폴백한다.
    //
    // ⚠️ .env에 `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`가 있으면
    // SDK가 자동으로 그 키를 잡아 IAM Role 폴백을 막는다. SES 키는
    // `SES_*` 네임스페이스로 분리해 .env의 AWS_* 충돌을 회피한다.
    s3ClientSingleton = new S3Client({
      region: env.AWS_REGION || 'ap-northeast-2',
    });
  }
  return s3ClientSingleton;
}

/** 업로드 대상 공개 URL 생성 (업로드 응답용). */
export function buildPublicUrl(key: string): string {
  if (env.S3_UPLOAD_PUBLIC_URL) {
    return `${env.S3_UPLOAD_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  const region = env.AWS_REGION || 'ap-northeast-2';
  return `https://${env.S3_UPLOAD_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}

/** 업로드 키 prefix 정규화 (양끝 슬래시 제거, 미설정 시 ''). */
function normalizedUploadPrefix(): string {
  return env.S3_UPLOAD_PREFIX
    ? env.S3_UPLOAD_PREFIX.replace(/^\/+|\/+$/g, '')
    : '';
}

/**
 * 에디터 본문 이미지(`editor/` prefix) 키인지 검사.
 *
 * 비공개 버킷이므로 `/api/files/view` 인증 프록시는 **이 prefix의 객체만** 스트리밍한다.
 * (티켓 첨부는 `/api/attachments/[id]`가 담당 → 임의 객체 읽기 차단)
 */
export function isEditorUploadKey(key: string): boolean {
  const p = normalizedUploadPrefix();
  const expected = p ? `${p}/editor/` : 'editor/';
  return key.startsWith(expected);
}

/**
 * 에디터 본문 임베드 이미지용 **인증 프록시 URL**.
 *
 * 버킷이 비공개라 원본 S3 URL을 본문에 박으면 AccessDenied로 깨진다.
 * 대신 `/api/files/view?key=...` 상대 경로로 라우팅하여 로그인 게이트 통과 후 스트리밍.
 */
export function buildEditorProxyUrl(key: string): string {
  return `/api/files/view?key=${encodeURIComponent(key)}`;
}

/**
 * 마스터 아이콘 이미지(`master-icons/` prefix) 키인지 검사.
 *
 * 비공개 버킷이지만 이 아이콘은 공개 홈(비로그인)에 노출돼야 하므로
 * 인증 없는 공개 프록시(`/api/files/master-icon`)가 **이 prefix의 객체만** 스트리밍한다.
 * (브랜드 아이콘은 민감도 없음 + 키 추측 어려움)
 */
export function isMasterIconKey(key: string): boolean {
  const p = normalizedUploadPrefix();
  const expected = p ? `${p}/master-icons/` : 'master-icons/';
  return key.startsWith(expected);
}

/**
 * 마스터 아이콘용 **공개 프록시 URL**.
 *
 * 버킷이 비공개라 원본 S3 URL은 AccessDenied. 공개 홈에서도 보이도록
 * `/api/files/master-icon?key=...` 상대 경로로 라우팅(인증 없음·장기 캐시).
 */
export function buildMasterIconProxyUrl(key: string): string {
  return `/api/files/master-icon?key=${encodeURIComponent(key)}`;
}

/**
 * 홈 팝업 배너 이미지용 **공개 프록시 URL** (인증 없음).
 *
 * 팝업 배너는 비로그인 홈에 노출돼야 하나, 이미지는 `editor/` prefix로 업로드되어
 * 로그인 필수 `/api/files/view`로 저장된다. 그대로 두면 비로그인 시 401로 깨진다.
 * 대신 이 공개 프록시는 **DB에 등록된 활성 팝업 공지가 참조하는 키만** 스트리밍한다.
 */
export function buildPopupProxyUrl(key: string): string {
  return `/api/files/popup?key=${encodeURIComponent(key)}`;
}

/**
 * 업로드 프록시 URL(`/api/files/view|popup?key=...`) 또는 S3 URL에서 객체 키 추출.
 * 키를 못 구하면 null.
 */
export function extractUploadKey(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?&]key=([^&]+)/);
  if (m) return decodeURIComponent(m[1]).replace(/^\/+/, '');
  try {
    const u = new URL(url, 'http://_');
    const path = u.pathname.replace(/^\/+/, '');
    return path || null;
  } catch {
    return null;
  }
}

/**
 * 첨부 레코드(pathname/blobUrl)에서 실제 GetObject 대상 { bucket, key } 도출.
 *
 * - key: `pathname`이 URL이 아니면 그대로(앞 슬래시 제거). URL이거나 비어있으면 `blobUrl`에서 path 추출.
 * - bucket: `S3_UPLOAD_BUCKET` 우선, 없으면 `blobUrl` 호스트(`<bucket>.s3...`)에서 유추.
 *
 * 키/버킷을 못 구하면 null.
 */
export function resolveS3Object(input: {
  pathname?: string | null;
  blobUrl?: string | null;
}): { bucket: string; key: string } | null {
  const { pathname, blobUrl } = input;

  let key: string | null = null;
  if (pathname && !/^https?:\/\//i.test(pathname)) {
    key = pathname.replace(/^\/+/, '');
  } else if (blobUrl) {
    try {
      key = decodeURIComponent(new URL(blobUrl).pathname).replace(/^\/+/, '');
    } catch {
      key = null;
    }
  }
  if (!key) return null;

  let bucket = env.S3_UPLOAD_BUCKET || '';
  if (!bucket && blobUrl) {
    try {
      const host = new URL(blobUrl).hostname; // <bucket>.s3.<region>.amazonaws.com
      const m = host.match(/^([^.]+)\.s3[.-]/i);
      if (m) bucket = m[1];
    } catch {
      /* noop */
    }
  }
  if (!bucket) return null;

  return { bucket, key };
}
