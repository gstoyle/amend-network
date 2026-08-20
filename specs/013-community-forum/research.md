# Research: Community Forum

## 1. Markdown and HTML

**Decision**: Reuse `parseAnnouncementBody` (bold, italic, allowlisted links). Reject `<` / `>`. No `dangerouslySetInnerHTML`. Split on newlines into paragraphs. No image uploads.

**Rationale**: Constitution II and PRD §5.7. Image pipeline (ClamAV + signed URLs) is a later slice.

**Alternatives**: remark/rehype — extra dependency; stored HTML — rejected.

## 2. Thread shape

**Decision**: Two levels only (thread + ordered posts). No parent_post_id.

**Rationale**: PRD §5.7 launch shape.

## 3. Moderation surface

**Decision**: Flag, hide, delete (soft), lock, pin. No `user_forum_suspended` writes.

**Rationale**: PRD §11 launch cut.

## 4. Staff visibility

**Decision**: Moderator, Admin, Super Admin SELECT all categories/threads/posts for moderation. Category INSERT/UPDATE: Admin and Super Admin only (same set as announcements, not events).

**Rationale**: Moderators already manage events; they must see every room. Category taxonomy stays with content admins.

## 5. Author names

**Decision**: Decrypt given/family name for display on posts the viewer can already see. Empty → “Member”. Not gated on directory opt-in.

**Rationale**: A post is an intentional public (to the category) statement. Directory opt-in is search/browse, not authorship.

## 6. Email

**Decision**: SECURITY DEFINER `forum_thread_subscriber_emails(thread_id)` returns encrypted addresses excluding the author, only if the caller can see the thread. App decrypts and sends via existing json/smtp transport. Unsubscribe HMAC uses `AUTH_SECRET`.

**Rationale**: Same pattern as event RSVP recipient emails; RLS on subscriptions is own-row only.

## 7. Rate limits

**Decision**: Table `forum_post_throttle` with minute thread count, minute post count, hour post count. Application enforced inside `withRls`, like directory search.

## 8. Navigation

**Decision**: Insert Forum between Events and Directory. Five primary destinations; no overflow.

**Rationale**: Assumptions log said overflow is for a sixth destination. This is the fifth.
