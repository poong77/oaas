---
name: phase-7-8-completion
description: Phase 7 (NT-01 notices) and Phase 8 (CB-01/02/03 chatbot FAB) implementation status as of 2026-05-28
metadata:
  type: project
---

Phase 7 + 8 complete on 2026-05-28. Single notices table covers notice/release/incident kinds. Chatbot FAB mounted in root layout with embedUrl prop pattern (server-only chain preserved via lib/services/chatbot-meta.ts).

**Why:** User requested batching both phases (small work) and wanted notices placeholder fully replaced plus chatbot widget across all hotelier pages. CB-04 (P2) deferred to Phase 9+ but `from=chatbot` context pattern already wired in /tickets/new.

**How to apply:** Phase 9 implementation should reuse the same patterns:
- pgEnum named distinctly from table (`notice_kind` vs `notices`)
- summarizeNoticeBody helper for body_markdown previews — reuse for similar widgets
- ChatbotFab exclusion list (/login, /admin/*, /profile/staff) — extend if new admin areas added
- emergency-banner.tsx layered structure (service_status + notices.banner) — extend pattern for future banner sources

Pending in [[chatbot-embed-url-followup]]: OACHAT_EMBED_URL is currently empty in Vercel, fallback card shown. Once real key set, no code change needed.
