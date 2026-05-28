---
name: notices-naming
description: Drizzle pgEnum name must differ from table name to avoid runtime/migration conflicts (Phase 5/6 learning, applied in Phase 7 notices)
metadata:
  type: feedback
---

When defining a Drizzle table with a pgEnum column, the enum name and table name must be distinct. Phase 7 uses `notice_kind` enum + `notices` table (correct). Phase 5/6 had earlier issues with same-name enum/table that required cleanup.

**Why:** PostgreSQL allows same name in different namespaces but Drizzle's migration generation can produce confusing DDL and the runtime client occasionally trips. The user explicitly called this out as a must-follow rule in the Phase 7+8 spec.

**How to apply:** For every new pgEnum, name it `<entity>_kind` or `<entity>_status` (e.g., `service_status_kind` for `service_status` table, `ticket_feedback_rating_kind` for `ticket_feedback` table). Never `notices`+`notices`, `tickets`+`tickets`, etc.
