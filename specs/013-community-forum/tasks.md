# Tasks: Community Forum

## Phase 1: Foundation

- [x] T001 Write spec, plan, research, data-model, contracts
- [x] T002 Prisma models + SQL migration with RLS, seed categories, subscriber-email function
- [x] T003 Forum validate, throttle, list, post, flag, moderate, subscribe, notify
- [x] T004 Analytics event names (opaque ids) + forum email kind
- [x] T005 Audit actions already exist; wire writes on each mutation

## Phase 2: US1 Browse

- [x] T006 Member `/app/forum` and `/app/forum/[slug]`
- [x] T007 Thread page `/app/forum/t/[id]`
- [x] T008 Nav + home recent activity + forum icon
- [x] T009 RLS tests for category/thread visibility

## Phase 3: US2–US3 Post

- [x] T010 New thread + reply routes
- [x] T011 Edit within 15 minutes
- [x] T012 Throttle tests
- [x] T013 Permission matrix view_forum / post_forum

## Phase 4: US4 Moderate

- [x] T014 Flag + admin flag queue
- [x] T015 Hide, delete, lock, pin
- [x] T016 Permission matrix moderate_forum + RLS staff tests

## Phase 5: US5 Subscribe + guidelines

- [x] T017 Subscribe/unsubscribe + email
- [x] T018 `/community-guidelines`
- [x] T019 Unit tests for markdown/validate; a11y layout snippet
- [x] T020 Assumptions log + feature.json; quality gates
