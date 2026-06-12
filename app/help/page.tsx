/**
 * /help — 핸드북 허브 인덱스(SS-02)는 홈과 중복되어 노출하지 않습니다.
 *
 * 셀프서치 본체(/help/[product], 아티클 상세, /search)는 그대로 유지하고,
 * 인덱스 진입(또는 옛 북마크)만 홈으로 리다이렉트합니다.
 * 되돌리려면 git 이력에서 기존 HelpIndexPage 본문을 복구하세요.
 */

import { redirect } from 'next/navigation';

export default function HelpIndexRedirect() {
  redirect('/');
}
