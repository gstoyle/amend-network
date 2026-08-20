# RLS contract: forum

Runtime role `amend_app`. GUCs unchanged. `app_role_tokens()` unchanged.

Staff predicate: `current_setting('app.admin_role', true) IN ('admin', 'super_admin', 'moderator')`.

Content-admin predicate: `IN ('admin', 'super_admin')`.

## forum_category_visible_core(id)

SECURITY DEFINER: category exists AND `visibility && app_role_tokens()`.

## forum_thread_writable(id)

SECURITY DEFINER: category visible AND thread `deleted_at`/`hidden_at` null AND `locked = false`.

## Policies (summary)

| Table | SELECT | INSERT | UPDATE |
| --- | --- | --- | --- |
| forum_categories | core OR staff | content-admin | content-admin |
| forum_threads | (core category AND not deleted AND (not hidden OR staff)) OR staff | author = user AND core category | staff |
| forum_posts | (thread member-visible AND not deleted AND (not hidden OR staff)) OR staff | author = user AND writable thread | author own body (app enforces 15 min) OR staff |
| forum_flags | staff | reporter = user AND post member-visible | staff |
| forum_subscriptions | own row | own row AND thread visible | own row (delete via delete grant? UPDATE unused; DELETE own) |
| forum_post_throttle | own row | own row | own row |

GRANT SELECT, INSERT, UPDATE as needed. Subscriptions GRANT DELETE for own-row unsubscribe. No TRUNCATE. No member DELETE on posts (soft-delete via UPDATE).

`forum_thread_subscriber_emails(thread_id)` SECURITY DEFINER: emails of subscribers except `app.user_id`, only if caller can see the thread.
