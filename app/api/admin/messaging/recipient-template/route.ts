/**
 * 수신자 일괄 업로드용 엑셀 양식 다운로드 (MSG-17).
 *
 * 엑셀에서 바로 열리는 CSV(UTF-8 BOM). 컬럼: 업체명·이메일·연락처·담당자명·변수명1~7.
 * 매니저·어드민만.
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET() {
  await requireRole(['manager', 'admin']);

  const headers = [
    '업체명',
    '이메일',
    '연락처',
    '담당자명',
    '변수명1',
    '변수명2',
    '변수명3',
    '변수명4',
    '변수명5',
    '변수명6',
    '변수명7',
  ];
  const sample = [
    '그랜드호텔,grand@example.com,010-1234-5678,김호텔,120,VIP,,,,,',
    '오션리조트,ocean@example.com,010-8765-4321,이리조트,240,일반,,,,,',
  ];
  // UTF-8 BOM → 엑셀 한글 깨짐 방지
  const csv = '﻿' + [headers.join(','), ...sample].join('\r\n') + '\r\n';

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="recipient-template.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
