-- Internal RSVP advisory-lock key. Not a public identifier.
-- PK remains events.id (uuid). event_join_links / event_rsvps FKs unchanged.
ALTER TABLE "events" ADD COLUMN "lock_key" BIGSERIAL;
ALTER TABLE "events" ADD CONSTRAINT "events_lock_key_key" UNIQUE ("lock_key");
