# Data Model: Member Page Layouts

**Slice**: `012-member-page-layouts` | **Spec**: [spec.md](./spec.md)

This slice adds **no table, column, migration, index, or RLS policy**. The `Resource`,
`Event`, `EventRsvp`, and `Announcement` models already hold every value the design displays;
three of them are simply not selected or not derived today.

What follows is the set of view-model extensions and the derivation rules behind them. Every
derivation lives in `lib/`, never in a component, because `components/` is presentational and
carries no role logic.

---

## Extended view models

### `MemberResource` — `lib/resources/list.ts`

| Field | Status | Source |
| --- | --- | --- |
| `id`, `title`, `previewText`, `sourceLabel`, `tags`, `updatedAt`, `thumbnailHref`, `fileMimeType`, `playbackHref` | existing | unchanged |
| `formatLabel: ResourceFormat \| null` | **new** | derived from `fileMimeType` |
| `sizeLabel: string \| null` | **new** | derived from `fileSizeBytes` |
| `audience: AudienceMarker` | **new** | derived from `visibility` |

`fileSizeBytes` and `visibility` are added to the Prisma `select`. Both already exist on the
model. `fileSizeBytes` is a `BigInt` and must be converted before it crosses into a component.

### `MemberEvent` — `lib/events/list.ts`

| Field | Status | Source |
| --- | --- | --- |
| `id`, `title`, `description`, `startsAt`, `endsAt`, `timezoneHint`, `location`, `isVirtual`, `capacity` | existing | unchanged |
| `viewerRsvpStatus: StoredRsvpStatus \| null` | **new** | the viewer's own `EventRsvp` row |
| `confirmedCount: number` | **new** | count of `EventRsvp` with status `yes` |
| `audience: AudienceMarker` | **new** | derived from `visibility` |

Both new reads resolve inside the existing `withRls` transaction. Neither widens visibility:
the RSVP row is the viewer's own, keyed by `(userId, eventId)`, and the count aggregates only
over events whose `visibility` the viewer's tokens already intersect.

### `MemberBanner` — `lib/announcements/list.ts`

| Field | Status | Source |
| --- | --- | --- |
| `id`, `headline`, `body`, `dismissible`, `ctaPrimaryLabel`, `ctaSecondaryLabel` | existing | unchanged |
| `postedAt: Date` | **new** | `activatesAt` |

CTA destinations remain server routes. No CTA URL is added to this type, so nothing about the
`005` design changes.

### `ShellIdentity` — `lib/profile/identity.ts`

| Field | Status | Source |
| --- | --- | --- |
| `displayName`, `initials`, `programRoleLabel` | existing | unchanged |
| `firstName: string \| null` | **new** | decrypted first-name column |

`firstName` is `null` whenever the display name fell back, so home can choose a neutral
greeting rather than splitting a fallback string. It is the same already-decrypted value, so
no additional column is selected and no new PII reaches the client beyond the name the shell
already renders.

---

## New types

```text
ResourceFormat  = "PDF" | "Video" | "Slides" | "Template" | "Toolkit"
AudienceMarker  = { label: string; restricted: boolean }
```

---

## Derivation rules

### Format label — from `fileMimeType`

| Stored MIME type | `formatLabel` |
| --- | --- |
| `application/pdf` | `PDF` |
| `video/mp4` | `Video` |
| `application/vnd.openxmlformats-officedocument.presentationml.presentation`, `application/vnd.ms-powerpoint` | `Slides` |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/msword`, `text/markdown` | `Template` |
| `application/zip` | `Toolkit` |
| anything else | `null` |

Validation: an unrecognised type yields `null` and the card omits the format entirely. No
placeholder, no "Unknown" (FR-008).

### Size label — from `fileSizeBytes`

| Byte count | `sizeLabel` |
| --- | --- |
| `<= 0` or absent | `null` |
| `< 1024` | `"N bytes"` |
| `< 1024²` | whole kilobytes, e.g. `"380 KB"` |
| `< 1024³` | one decimal megabyte, e.g. `"4.2 MB"` |
| otherwise | one decimal gigabyte, e.g. `"1.3 GB"` |

Validation: the `BigInt` is converted once, in `lib/`. Trailing `.0` is trimmed, so a 4 MB file
reads `4 MB` rather than `4.0 MB` (FR-009).

### Audience marker — from `visibility: string[]`

Lives in `lib/db/visibility.ts`, which already owns the
`all_authenticated | pathways | lead` vocabulary alongside `visibilityTokens`.

| Visibility set contains | `label` | `restricted` |
| --- | --- | --- |
| `all_authenticated` | `All members` | `false` |
| `pathways` and `lead`, not `all_authenticated` | `Pathways to Change and LEAD` | `true` |
| `pathways` only | `Pathways to Change only` | `true` |
| `lead` only | `LEAD only` | `true` |
| empty or unrecognised | `Restricted` | `true` |

Labels reuse the exact program-role vocabulary already in `PROGRAM_ROLE_LABELS`, so a member
never sees two different names for the same programme.

**This is a label, not a gate.** `restricted` selects a tone and a lock glyph. It MUST NOT
disable, hide, or replace the download or register action, because a member is only ever served
rows their own tokens already intersect (FR-010, FR-032).

### Date chip and meta line — from `startsAt`

The chip carries an abbreviated month and the day of month; the meta line carries the full
weekday, day, abbreviated month, and the start-to-end time range. Both derive from the same
instant, so they can never disagree. Existing time rendering already handles the viewer's zone;
this slice changes presentation only (FR-024).

### Registration state — from `viewerRsvpStatus` and `capacity`

| Condition | Row shows |
| --- | --- |
| `viewerRsvpStatus === "yes"` | a registration confirmation, no register control |
| `viewerRsvpStatus === "waitlist"` | a waitlisted statement, no register control |
| `viewerRsvpStatus` is `no`, `maybe`, or `null` | a register control linking to the event |
| `capacity === null` | no capacity note |
| `capacity !== null` | remaining seats as `capacity - confirmedCount`, floored at zero |

---

## What is deliberately absent

- **No new persisted entity.** Nothing here is written; every field is read-derived.
- **No new visibility rule.** `visibilityTokens` is unchanged, so the permission matrix must
  produce byte-identical results before and after (SC-010).
- **No blog or forum entity.** The reserved home column has no data source by design; it holds
  static copy only (FR-021).
- **No client-side role value.** No component receives a role or a visibility array. It receives
  finished labels (FR-031).
