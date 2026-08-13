# ADR-0001: Host the Member Network on a DreamHost Self-Managed VPS

- **Status:** Proposed, pending executive sponsor acknowledgement
- **Date:** 2026-08-12
- **Supersedes:** PRD v1.0 §4 hosting recommendation (Vercel + Supabase/Neon + Cloudflare R2)
- **Related:** PRD v1.1 §4, §8, §9, §10, §11 Q13 and Q17–Q20

## Context

PRD v1.0 recommended a managed-platform deployment: Vercel for the application, Supabase or Neon for PostgreSQL, and Cloudflare R2 for object storage. That recommendation optimised for a small maintaining team by pushing patching, backups, scaling, and edge protection onto vendors.

The client has directed that the platform be hosted on DreamHost, where the main amend.us WordPress site already lives.

DreamHost's product line constrains this sharply:

- **Shared hosting and DreamPress cannot run this application.** Node.js applications are supported only on VPS and Dedicated plans. Attempting to install a runtime on a shared plan can trigger an automated account lockout.
- **Managed VPS provides no root access**, which rules out self-hosted PostgreSQL, ClamAV, and a custom systemd service.
- **Self-Managed VPS** (launched June 2026) provides full root, Docker and KVM, unmetered bandwidth, NVMe storage, DDoS protection, and an application library that includes PostgreSQL.

Self-Managed VPS is therefore the only DreamHost product that can host the platform as specified.

## Decision

Deploy to **DreamHost Self-Managed VPS**, Ubuntu 24.04 LTS:

| Layer | Choice |
|---|---|
| Production instance | Stack 16 (4 vCPU, 16 GB RAM, 250 GB NVMe) |
| Staging instance | Stack 4 (2 vCPU, 4 GB, 75 GB) — required by §10's 14-day soak |
| Application | Next.js 14+ in standalone output, Node 24 LTS under systemd |
| Web server | nginx, TLS via Let's Encrypt/certbot with a monitored renewal hook |
| Database | PostgreSQL 16, self-hosted, co-resident, RLS enabled |
| Object storage | DreamObjects (S3-compatible), private bucket, signed URLs |
| Edge | Cloudflare for DNS, WAF, rate limiting, bot protection; origin firewalled to Cloudflare ranges |
| Jobs | System cron |
| CI/CD | GitHub Actions → SSH deploy to staging, gated promotion to production |
| Secrets | systemd `EnvironmentFile` (0600, root) sourced from 1Password Secrets Automation or Doppler |

**The application framework does not change.** The constraint is on infrastructure, not on stack. Next.js runs on any host that runs Node. Changing framework because hosting changed would force a rewrite of the §4 authorization model with no corresponding benefit.

## Consequences

### Positive

- Lower recurring cost. Roughly $21/month intro, $34/month at renewal for both instances, against a managed-platform path in the low-to-mid three figures.
- One vendor, one bill, alongside the existing WordPress site.
- No vendor lock-in and no usage-based billing surprises during a traffic spike.
- Full root enables ClamAV as a local daemon, PostgreSQL tuning, and RLS without a managed-database intermediary.
- **Row-level security is retained.** RLS is a native PostgreSQL feature, not a Supabase one, so the third enforcement layer in §4 survives intact.

### Negative, and these are the ones that matter

- **Security patching moves from a vendor to a person.** OS and kernel updates, dependency patching on the host, and SSH hardening become Amend's responsibility. For a platform holding data about corrections-affiliated individuals under a 7-year audit retention obligation, this is a material change in posture.
- **Backups become self-operated.** No managed-database point-in-time recovery. `pg_dump`, WAL archiving, off-box storage, and restore drills are all built and maintained in-house.
- **No automatic failover.** Single-node deployment. DreamHost's uptime guarantee covers hardware, network, and connectivity; it does not cover a crashed process, a failed migration, or a full disk. The §8 target of 99.5% becomes an operational commitment rather than a purchased one.
- **No managed KMS.** PII column encryption keys are held in an environment file and the secrets manager. Rotation is a documented manual procedure.
- **No zero-config preview deployments.** §4's per-PR preview environments require either a shared staging environment or an added tool (Dokploy).
- **Roughly one additional week of Phase 0 work** to provision, harden, script, and drill the infrastructure, on a timeline that was already compressed.

### Neutral

- Postmark, PostHog, and Sentry are unaffected; they are API integrations.
- Object storage is accessed through a single S3-compatible client wrapper, so a later migration to R2 or S3 is a configuration change.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Unpatched OS vulnerability | `unattended-upgrades` for security patches; monthly maintenance window for kernel and major versions; named owner (Q17) |
| Backup exists but cannot be restored | Restore drill against a clean VPS is a Phase 0 exit criterion, repeated monthly with a recorded recovery time |
| Origin reachable directly, bypassing the WAF | Firewall permits 80/443 from Cloudflare IP ranges only; verified by an external scan before launch |
| Full disk on a co-resident database | Disk alerting at 70%; documented growth projection; Stack 32 upgrade path |
| Single-node outage extends beyond tolerance | Documented rebuild-from-backup with measured RTO; warm standby priced in Q18 |
| No named ops owner at handover | Q17 blocks runbook sign-off, which blocks handover |

## Open questions this creates

Added to PRD §11:

- **Q13 (revised, now blocking):** Data residency. DreamHost is US-based. An EU requirement conflicts with this decision and must be resolved before provisioning.
- **Q17:** Named owner for OS patching, backup verification, and incident response after launch, and their availability.
- **Q18:** Is a second production VPS (warm standby) in budget, or is single-node with restore-from-backup the accepted recovery model?
- **Q19:** Acceptable RTO and RPO for total database loss.
- **Q20:** Does the executive sponsor accept, in writing, the transfer of security patching, backup integrity, and incident response from a managed platform to Amend's technical lead?

## Acknowledgement

Q20 is the reason this ADR exists. The hosting choice is the client's to make and there are good reasons behind it. But it changes who is responsible when something goes wrong, on a platform where "something goes wrong" can mean disclosure of a member's affiliation with a correctional institution.

That trade should be visible to the person who signs off on the platform's compliance posture, not buried in an architecture table.

- Executive sponsor: ______________________  Date: __________
- Technical lead: ________________________  Date: __________
