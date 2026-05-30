## 아티클관리시스템

- **기간**: 2026-05-29 ~ 2026-05-30
- **Match Rate**: 94% (≥90% 통과)
- **상태**: 🟢 COMPLETE
- **소유자**: OA 운영팀 매니저

### 문서 (4개)

- [Plan](아티클관리시스템/아티클관리시스템.plan.md) — Q-1~Q-16 결정 16개
- [Design](아티클관리시스템/아티클관리시스템.design.md) — D-1~D-6 결정 6개 추가
- [Analysis](아티클관리시스템/아티클관리시스템.analysis.md) — 9개 영역 Gap, Match Rate 94%
- [Report](아티클관리시스템/아티클관리시스템.report.md) — 4-perspective Value + 학습/회고

### 핵심 산출물 (코드 경로)

- DB: `db/schema/articles.ts` (확장), `db/schema/article-redirects.ts` (신규), `db/migrations/0015_*.sql` + `0016_related_slugs_backfill.sql`
- 유틸: `lib/articles/{slug,toc-extractor,body-validator,zod-schemas}.ts`
- 서비스: `lib/services/articles.ts` (확장), `lib/services/article-redirects.ts`
- 액션: `app/actions/article-actions.ts` (확장, P1-1 통합 완료)
- 페이지: `app/(admin)/admin/articles/*`, `[id]/preview`, `sandbox/markdown-matrix`, `app/help/[product]/[content_type]/[slug]`, `[product]/[slug]` (308)
- 에디터: `components/editor/rich-editor.tsx` (Option A markdown 회귀)

### 미진행 후속 (트리거 조건 도달 시)

- **P1-3**: cascading menu-path-cascade + applies-to-editor — 매니저 피드백 후 (2~4주)
- **P1-4**: tsvector @@ to_tsquery — 콘텐츠 100건 (1~3개월)
- **P1-5**: deprecated 컬럼 (`summary_30s`, `related_article_ids`) DROP — 회귀 안정 후 (2~4주)
- **별도 Plan**: 아티클-RAG임베딩, 채널.io 마이그레이션