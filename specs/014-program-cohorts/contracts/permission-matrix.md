# Permission Matrix Additions

Rows added to the PRD §3 capability matrix. Each runs through the app (integration) and through Postgres (`pnpm test:rls`).

| Capability | Super Admin | Admin | Moderator | GLE member | LEAD member | Pending | Signed out |
|------------|-------------|-------|-----------|------------|-------------|---------|------------|
| Manage cohorts (create/rename/archive) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage cohort memberships | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Target cohorts when publishing resources/announcements | ✅ | ✅ | ❌ (can't publish these today) | ❌ | ❌ | ❌ | ❌ |
| Target cohorts on events | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create cohort forum room | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View own-cohort-only content | ✅ (all) | ✅ (all) | ✅ (all) | own cohorts | own cohorts | ❌ | ❌ |
| View other-cohort-only content | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| See cohort labels / filter in directory | ✅ | ✅ | ✅ | GLE cohorts | LEAD cohorts | ❌ | ❌ |

Every refusal is asserted in the same test as the allowed case (Constitution IV: reject, not only accept).
