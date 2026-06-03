/**
 * `/api/admin/knowledge-export?format=md|jsonl&product=...` — CB-05.
 *
 * 발행 아티클 + 활성 FAQ + 동의어를 AI 최적 포맷으로 가공해 파일 다운로드.
 * 매니저+어드민 전용.
 */

import { type NextRequest, NextResponse } from 'next/server';

import { getCurrentUser } from '@/lib/permissions';
import {
  buildKnowledgePack,
  toJsonl,
  toMarkdown,
} from '@/lib/services/knowledge-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
    return NextResponse.json(
      { ok: false, message: '권한이 없습니다' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get('format') ?? 'md').toLowerCase();
  const productCode = searchParams.get('product')?.trim() || undefined;

  if (format !== 'md' && format !== 'jsonl') {
    return NextResponse.json(
      { ok: false, message: 'format은 md 또는 jsonl 이어야 합니다' },
      { status: 400 },
    );
  }

  const pack = await buildKnowledgePack({ productCode });

  const stamp = pack.generatedAt.toISOString().slice(0, 10);
  const scope = productCode ? `-${productCode}` : '';
  const isMd = format === 'md';
  const body = isMd ? toMarkdown(pack) : toJsonl(pack);
  const filename = `oa-knowledge${scope}-${stamp}.${isMd ? 'md' : 'jsonl'}`;
  const contentType = isMd
    ? 'text/markdown; charset=utf-8'
    : 'application/x-ndjson; charset=utf-8';

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'no-store',
    },
  });
}
