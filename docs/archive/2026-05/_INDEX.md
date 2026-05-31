## kb-search-synonym (제품 가이드 검색 동의어 확장)

- **기간**: 2026-05-31 (단일 세션)
- **Match Rate**: 92% (≥90% 통과)
- **상태**: 🟢 COMPLETE
- **유형**: 버그 수정 + 리팩터링 + 클린업

### 문서 (1개)

- [Report](kb-search-synonym/04-report.md) — 4-perspective Value + 학습/회고 (버그수정 건이라 plan/design/analysis 문서 생략, Check는 인라인 92%)

### 핵심 산출물 (코드 경로)

- 서비스: `lib/services/articles.ts` — `buildArticleSearchCondition()` 공용 헬퍼, `listArticles` 동의어 확장 적용, `arrayOverlaps` 파라미터 바인딩
- 서비스: `lib/services/master-synonyms.ts` — `_deprecatedLoadSynonymIndex` 죽은 코드 제거
- 문서: `docs/IMPLEMENTATION_PLAN.md` — SS "검색 동의어 확장 (v1.2)" 명세
- 커밋: `eba60b0`, `6550857`, `7a57328`, `9998fa1`

### 학습

- 마스터 데이터는 소비처(검색 함수)까지 연결 확인 필요
- gap-detector 지적도 검증 대상 — `revalidateTag(tag, "default")`는 Next 16에서 정상 (오판)

### 미진행 후속 (트리거 조건 도달 시)

- 🔵 keywords GIN leg 대소문자/공백 정규화 — keywords 저장 정규화 정책 도입 시 (현재 ILIKE leg가 보완)

---

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