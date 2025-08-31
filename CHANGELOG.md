# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Dexie adapter for IndexedDB: `src/lib/dexie-db.ts` mirrors `src/lib/idb.ts` schema up to DB_VERSION 9.
- Storage proxy: `src/lib/storage.ts` delegates to Dexie when `VITE_USE_DEXIE=true`, otherwise defaults to IDB. No behavior change by default.

### Changed
- Exam date handling now uses local-day normalization to avoid timezone drift:
  - `src/lib/date-utils.ts` provides `asLocalDayISO()` and `parseExamDateAsLocal()`.
  - `src/pages/EditExamPage.tsx` renders and saves dates using local-day helpers.
  - `src/lib/exam-utils.ts` parses `exam.date` with local-day semantics in progress and retention calculations.
  - Backward compatible: dates continue to be stored as ISO strings.

### Observability
- Added lightweight observability helpers `src/lib/obs.ts` (integrates with Sentry if available; otherwise logs).
- Added breadcrumbs and messages to `EditExamPage.tsx` submit flow.

### Accessibility
- Added screen-reader error summary (aria-live assertive) and focus management on invalid form submissions in `EditExamPage.tsx`.

### Tests
- Added unit tests: `src/lib/__tests__/exam-utils.test.ts` covering filter modes and tag logic for cards and MCQs (Vitest).
- Scaffolded Playwright E2E config and a basic Edit Exam spec under `e2e/`.

### Migration Notes (DB v1 → v9)
- Schema parity with existing IDB upgrade path:
  - v1: `decks (id)`
  - v2: `review_logs (++id, cardId)`
  - v3: `media (id)`
  - v4: `session_state` (key-value)
  - v5: `question_banks (id)`
  - v6: `mcq_review_logs (++id, mcqId)`
  - v8: `exams (id)`
  - v9: `exam_logs (id)`

Dexie tables are defined with matching primary keys and indexes. This allows seamless switching between engines per browser profile. There is no destructive migration; tables are created if missing.

### Enabling Dexie (opt-in)
1. Install Dexie (local dev only unless you intend to ship Dexie):
   - npm i dexie
2. Create `.env.local` with:
   - VITE_USE_DEXIE=true
3. Ensure all imports reference the proxy module `@/lib/storage` (not `@/lib/idb`).

### Rollback Plan
- Set `VITE_USE_DEXIE=false` or remove the flag to immediately revert to the IDB implementation.
- No data loss expected: both engines target the same database name (`PrepigoDB`) and store names. Browser storage is preserved.

### Known limitations
- Background sync engine, `syncQueue`, and `meta` stores are not yet implemented. Planned for a subsequent version to meet offline-first spec.

---

## [Next] - DB v10
### Added
- Add `syncQueue (++id, resource, createdAt)` and `meta (key)` stores to Dexie schema.
- Non-destructive migration: existing data preserved; new stores are created if missing.

### Notes
- These stores enable an operation-based sync engine and app-level metadata (e.g., lastSyncedAt per resource).
- Rollback: Dexie supports opening the DB at an earlier version; leaving v10 in place is safe even if unused.

## [0.0.0] - Initial
- Project scaffold with Vite + React + TypeScript, shadcn/ui + Radix, IDB-based persistence.
