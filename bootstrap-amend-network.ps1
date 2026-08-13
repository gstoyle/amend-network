<#
.SYNOPSIS
    Bootstraps the Amend Member Network repo for spec-driven development in Cursor.
    Target deployment: DreamHost Self-Managed VPS.

.DESCRIPTION
    Creates (or adopts, with -Here) the project directory, installs uv and the
    GitHub Spec Kit CLI, runs `specify init` with the Cursor integration, and
    writes AGENTS.md plus five .cursor/rules/*.mdc files and the docs/ and
    infra/ skeleton.

    Will not overwrite AGENTS.md or existing rule files unless -Force is passed.

.EXAMPLE
    # Create a new folder under a parent path
    .\bootstrap-amend-network.ps1 -ProjectPath "C:\dev" -ProjectName "amend-member-network"

.EXAMPLE
    # Use the directory you're already in (e.g. an existing GitHub-cloned repo)
    .\bootstrap-amend-network.ps1 -Here
#>

[CmdletBinding()]
param(
    [string]$ProjectPath  = "$HOME\dev",
    [string]$ProjectName  = "amend-member-network",
    [switch]$Here,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Write-Step { param($m) Write-Host "`n==> $m" -ForegroundColor Cyan }
function Write-Ok   { param($m) Write-Host "    OK  $m" -ForegroundColor Green }
function Write-Warn { param($m) Write-Host "    !!  $m" -ForegroundColor Yellow }
function Have       { param($c) [bool](Get-Command $c -ErrorAction SilentlyContinue) }

function Update-SessionPath {
    # Re-reads Machine + User PATH from the registry into this session.
    # Installers (uv, uv tool install) write to the registry but a running
    # PowerShell session doesn't pick that up on its own.
    $machine = [System.Environment]::GetEnvironmentVariable('Path','Machine')
    $user    = [System.Environment]::GetEnvironmentVariable('Path','User')
    $env:Path = "$machine;$user"
}

# ---------------------------------------------------------------- preflight

Write-Step "Checking prerequisites"

foreach ($tool in @('git','node','python')) {
    if (-not (Have $tool)) { throw "$tool is not on PATH. Install it and re-run." }
}

$nodeMajor = [int]((node --version) -replace '^v(\d+)\..*','$1')
if ($nodeMajor -lt 20) { throw "Node 20+ required locally. Found $(node --version)." }
Write-Ok "git, node $(node --version), python"

# ---------------------------------------------------------------- uv

Write-Step "Ensuring uv is installed"
if (-not (Have 'uv')) {
    Write-Warn "uv not found, installing"
    Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
    Update-SessionPath
    if (-not (Have 'uv')) { throw "uv install did not land on PATH. Open a new shell and re-run." }
}
Write-Ok "uv $(uv --version)"

# ---------------------------------------------------------------- specify (self-healing)

function Test-SpecifyWorks {
    if (-not (Have 'specify')) { return $false }
    try { $null = & specify version 2>&1; return $true }
    catch { return $false }
}

Write-Step "Ensuring Spec Kit (specify) is installed"

if (-not (Test-SpecifyWorks)) {
    # PowerShell 7.3+ promotes a non-zero exit from a native command into a
    # terminating error when $ErrorActionPreference is 'Stop', even with
    # stderr redirected. This install can legitimately fail on the first
    # try (see the self-heal branch below), so swallow here and let
    # Test-SpecifyWorks decide what happens next.
    try { uv tool install specify-cli 2>&1 | Out-Null } catch { Write-Warn "install attempt reported an error, will retry: $($_.Exception.Message)" }
    Update-SessionPath
}

if (-not (Test-SpecifyWorks)) {
    # Common on Windows: a stale/broken tool environment from an interrupted
    # first attempt (uv reports "Invalid environment ... missing Python
    # executable"). Clean it out and retry once before giving up.
    Write-Warn "First install attempt didn't produce a working specify. Cleaning and retrying."
    try { uv tool uninstall specify-cli 2>$null | Out-Null } catch { }
    $toolEnv = Join-Path $env:APPDATA 'uv\tools\specify-cli'
    if (Test-Path $toolEnv) { Remove-Item -Recurse -Force $toolEnv -ErrorAction SilentlyContinue }
    try { uv tool install specify-cli --reinstall } catch { Write-Warn "reinstall reported an error: $($_.Exception.Message)" }
    Update-SessionPath
}

if (-not (Test-SpecifyWorks)) {
    throw @"
specify still isn't working after a clean reinstall attempt.

Try by hand:
  uv python install 3.12
  uv tool install specify-cli --python 3.12 --reinstall

If it fails again the same way (an 'Invalid environment' or 'missing Python
executable' error), antivirus or endpoint protection is a likely culprit --
it can quarantine the Python binary uv just downloaded into the tool
environment. Check quarantine logs and consider excluding: $env:APPDATA\uv

Fallback that avoids uv's tool-venv mechanism entirely:
  pipx install specify-cli
"@
}
Write-Ok "specify CLI ready"

# ---------------------------------------------------------------- repo root

if ($Here) {
    $root = (Get-Location).Path
    Write-Step "Using current directory as repo root: $root"
} else {
    $root = Join-Path $ProjectPath $ProjectName
    Write-Step "Creating repo at $root"
}

if (-not (Test-Path $root)) {
    New-Item -ItemType Directory -Path $root -Force | Out-Null
} elseif (-not $Here -and -not $Force) {
    Write-Warn "Directory exists. Continuing (use -Force to overwrite generated files)."
}
Set-Location $root

if (-not (Test-Path (Join-Path $root '.git'))) {
    git init -b main | Out-Null
    Write-Ok "git initialised"
} else {
    Write-Ok "existing git repo detected, leaving it as-is"
}

New-Item -ItemType Directory -Force -Path `
    (Join-Path $root 'docs\prd'),
    (Join-Path $root 'docs\decisions'),
    (Join-Path $root 'docs\runbook'),
    (Join-Path $root 'infra\provision'),
    (Join-Path $root 'infra\deploy'),
    (Join-Path $root 'infra\backup'),
    (Join-Path $root '.cursor\rules') | Out-Null
Write-Ok "docs/ and infra/ skeleton created"

# ---------------------------------------------------------------- spec kit init

Write-Step "Running specify init (Cursor integration, PowerShell scripts)"

if (Test-Path (Join-Path $root '.specify')) {
    Write-Warn ".specify already present, skipping init"
} else {
    # NOTE: Spec Kit's CLI surface changes often. --integration replaced the
    # legacy --ai flag family in v0.10, and Cursor installs as skills under
    # .cursor/skills/. If this call is rejected, run
    #   specify init --help
    # and adjust. Do not fight the script.
    try {
        specify init . --integration cursor-agent --script ps --ignore-agent-tools
        Write-Ok "Spec Kit initialised"
    } catch {
        Write-Warn "specify init failed: $($_.Exception.Message)"
        Write-Warn "Run 'specify init --help', initialise manually, then re-run with -Force."
        throw
    }
}

# ---------------------------------------------------------------- AGENTS.md

Write-Step "Writing AGENTS.md"

$agentsPath = Join-Path $root 'AGENTS.md'
if ((Test-Path $agentsPath) -and -not $Force) {
    Write-Warn "AGENTS.md exists, skipping (use -Force to overwrite)"
} else {
@'
# AGENTS.md — Amend Member Network

Private, role-gated member platform for a correctional-system-adjacent user base,
running on infrastructure Amend operates. Read this before proposing any change.

Requirements: `docs/prd/amend-prd.md` (v1.1).
Current feature: the `spec.md` and `plan.md` in the active `specs/` directory.
Hosting decision: `docs/decisions/ADR-0001-dreamhost-hosting.md`.

## Stack

- Next.js 14+ (App Router), TypeScript strict, **standalone output** for self-hosting
- Tailwind CSS + shadcn/ui, themed entirely through CSS custom properties
- Auth.js v5, credentials + TOTP MFA for administrative roles
- PostgreSQL 16, self-hosted, **row-level security enabled**, Prisma
- DreamObjects (S3-compatible) for files, private bucket, signed URLs only
- Postmark (email), PostHog (analytics), Sentry (errors)

## Deployment target

DreamHost Self-Managed VPS, Ubuntu 24.04 LTS.
Node 24 LTS under **systemd** (not PM2), nginx reverse proxy, Let's Encrypt via certbot.
Cloudflare in front for DNS, WAF, and rate limiting. The origin firewall only accepts
80/443 from Cloudflare ranges, so the VPS IP cannot be reached directly.

There is no managed platform. No auto-scaling, no zero-config previews, no vendor KMS,
no vendor backups, no platform WAF. Anything the app needs, the app or `infra/` provides.

## Commands

```
pnpm dev            # local dev server
pnpm build          # next build (standalone)
pnpm test           # vitest unit + integration
pnpm test:rls       # permission matrix run directly against Postgres, app bypassed
pnpm lint
pnpm typecheck      # tsc --noEmit
pnpm test:a11y      # axe-core against built pages
pnpm db:migrate     # prisma migrate deploy
```

Infrastructure scripts live in `infra/` and are run against a host, never locally.

## Layout

```
app/            Next.js routes. (auth)/ (member)/ (admin)/ route groups.
lib/auth/       Session, requireRole, MFA. Server-only.
lib/audit/      Audit log writer. Append-only.
lib/storage/    Single S3-compatible client wrapper. No provider SDK calls elsewhere.
lib/db/         Prisma client and query helpers.
components/     Presentational. No data fetching, no role logic.
infra/          Provisioning, deploy, and backup scripts. Reviewed like production code.
specs/          Spec Kit feature artifacts. One directory per slice.
docs/prd/       Source PRD.
docs/decisions/ ADRs.
docs/runbook/   Operations runbook. Written in Phase 0, not after launch.
```

## Authorization model

Three enforcement layers. All three, every time, no exceptions:

1. Route middleware requires a session for `/app/*` and `/admin/*`.
2. Every server component and route handler calls `requireRole(...)` before
   returning data. Role comes from the signed session, never from the client.
3. Queries carry role-based WHERE clauses **and** PostgreSQL RLS policies are
   enabled on every content table. RLS is native Postgres and does not depend on
   any managed-database vendor. It is the layer that holds when layer 2 is missed.

Content entities have a `visibility` text[] of `all_authenticated | pathways | lead`.
A user sees an entity if any of their roles intersects it. GIN-indexed.

Administrative role is a separate claim from program role. Exactly one program role,
zero or one administrative role.

## Non-negotiables

- Never trust a role claim that came from the client.
- Never expose a direct object-storage URL. Downloads go through an authenticated
  handler that role-checks server-side and then issues a short-lived signed URL.
- Never send PII to PostHog. Opaque user IDs and role labels only.
- Never write raw HTML from user input. Forum content is markdown with a strict allowlist.
- Audit log rows are append-only. Corrections are new rows, never updates.
- No `remember me`. Shared-device access is expected. Session cookies expire on
  browser close in addition to the 24h sliding window.
- No secrets in Git, in test fixtures, or in log lines. Ever.
- PII column encryption is application-layer AES-256-GCM. There is no vendor KMS
  on this infrastructure, and full-disk encryption is not a substitute.
- Never hard-code a hostname, bucket name, region, or connection string. Environment
  variables only, so staging and production stay identical in code.

## Style

- Server components by default. `use client` only at leaf nodes.
- No hard-coded colour, font, or spacing values in components. Tokens only.
- Zod for every external input boundary.
- Errors surfaced to users never leak account state, existence, or reason.
'@ | Set-Content -Path $agentsPath -Encoding UTF8
    Write-Ok "AGENTS.md written"
}

# ---------------------------------------------------------------- cursor rules

Write-Step "Writing .cursor/rules"

function Write-Rule {
    param([string]$Name, [string]$Content)
    $p = Join-Path $root ".cursor\rules\$Name"
    if ((Test-Path $p) -and -not $Force) { Write-Warn "$Name exists, skipping"; return }
    $Content | Set-Content -Path $p -Encoding UTF8
    Write-Ok $Name
}

Write-Rule '000-project.mdc' @'
---
description: Core project constraints for the Amend Member Network
alwaysApply: true
---

- Requirements live in docs/prd/amend-prd.md and the active specs/ directory. Cite the section you are implementing against.
- Role checks happen server-side, from the signed session, on every data path. Never from the client.
- Content visibility is a text[] intersection against the user's roles, backed by Postgres RLS. Never a hard-coded role branch in a component.
- No PII to PostHog. Opaque IDs and role labels only.
- Audit log is append-only.
- This runs on a self-managed VPS. There is no managed platform behind you: no vendor KMS, no vendor backups, no platform WAF, no auto-scaling. Do not assume a capability the infra/ directory does not provide.
- Never hard-code a hostname, bucket, region, or connection string. Environment variables only.
- Prefer extending an existing helper over creating a new file. If you create one, say why extension was not possible.
'@

Write-Rule '010-auth-security.mdc' @'
---
description: Security rules for auth, sessions, RBAC, and audit logging
globs:
  - "lib/auth/**/*.ts"
  - "lib/audit/**/*.ts"
  - "app/api/**/*.ts"
  - "middleware.ts"
alwaysApply: false
---

Do these, not the alternatives, because this platform serves users inside the correctional system:

- Passwords: Argon2id. Minimum 12 chars, no composition rules (NIST SP 800-63B). bcrypt only if Argon2 is unavailable, and then cost >= 12.
- Sessions: httpOnly, Secure, SameSite=Lax. 24h sliding, 30d absolute. Server-side session record required so logout and revoke actually invalidate.
- Lockout: 10 failures in 15 min locks for 15 min and writes a `security` severity audit row. The response must not reveal whether the account exists.
- Auth failure messages are identical for pending, denied, deactivated, and nonexistent. No state leakage.
- Password reset: 60-minute single-use token. Completion invalidates all sessions for that user.
- Every /admin route requires `mfa_satisfied` on the session, not just an admin role claim.
- Every auditable action writes to the audit log synchronously, in the same transaction as the change.
- CSRF protection on every state-changing request.
- PII column encryption is application-layer AES-256-GCM with the key from the environment. There is no managed KMS here. Never invent one.
'@

Write-Rule '020-testing.mdc' @'
---
description: TDD discipline and the permission matrix test suite
globs:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
alwaysApply: false
---

- Write the failing test first. If code exists without a test that failed before it, delete the code and start again.
- Run the suite after each task, not at the end of the feature. A regression found five tasks later costs a bisect.
- Every row of the PRD section 3 capability matrix is an assertion. Seven roles by twenty-one capabilities.
- Run that matrix twice: once through the application, once directly against Postgres with the application bypassed, to prove RLS holds independently. The second run is `pnpm test:rls` and is not optional.
- Every route handler has a test asserting it rejects an unauthorised role, not only that it accepts an authorised one.
- Add an outbound-payload assertion for the analytics client that fails the build if any denylisted PII field appears in an event.
- No mocking of the role check helper in tests that exist to verify the role check.
'@

Write-Rule '030-accessibility-ui.mdc' @'
---
description: Accessibility and UI token rules for React components
globs:
  - "app/**/*.tsx"
  - "components/**/*.tsx"
alwaysApply: false
---

WCAG 2.1 AA is a launch requirement, not a polish item.

- No hard-coded colour, font-size, radius, or spacing values. Use design tokens exposed as CSS custom properties via the Tailwind theme.
- Contrast: 4.5:1 body text, 3:1 large text and interactive boundaries. Focus indicators 3:1 against adjacent colour.
- Every interactive target >= 44x44 CSS px.
- Semantic HTML: real landmarks, correct heading order, lists as lists, a label on every form control. No div-with-onClick.
- Mobile-first: design at 360px, enhance upward. No horizontal scroll at 360px except explicitly containerised data tables.
- Respect prefers-reduced-motion. No autoplay video. No animation over 5s without user control.
- Server components by default. `use client` at leaf nodes only, to hold the authenticated shell under the 180KB gzip budget.
- Self-hosted: there is no platform image optimisation. Use next/image with a configured local loader and check the LCP budget early rather than at the end.
'@

Write-Rule '040-infrastructure.mdc' @'
---
description: Rules for provisioning, deployment, and backup scripts on the DreamHost VPS
globs:
  - "infra/**"
  - "*.service"
  - "Dockerfile*"
  - ".github/workflows/**"
alwaysApply: false
---

Target: DreamHost Self-Managed VPS, Ubuntu 24.04 LTS. Full root, no managed platform.

- Everything is a script in infra/. Nothing is configured by hand through a control panel. Staging is only useful if it is reproducible from the same scripts as production.
- Scripts are idempotent and safe to re-run. Check before you create.
- SSH: key-only, root login disabled, password auth disabled, fail2ban enabled.
- Firewall: deny by default. 80/443 from Cloudflare IP ranges only. 22 from an allowlist. The origin must not be reachable by IP.
- TLS: certbot with a renewal hook that alerts on failure. A silent renewal failure is a defect, not an inconvenience.
- The app runs under systemd with Restart=always, a non-root service user, and EnvironmentFile at 0600 owned by root. Not PM2.
- Postgres: local socket or loopback only, never bound to a public interface. RLS enabled on content tables at migration time.
- Backups: nightly pg_dump --format=custom pushed off-box to DreamObjects, plus WAL archiving. A backup that has never been restored is not a backup; the restore script lives beside the backup script and is exercised monthly.
- Alerting on disk utilisation (threshold 70%), memory pressure, process health, and certificate expiry. A co-resident database on a full disk is an unrecoverable-until-manual outage.
- Never echo a secret. Never write one to a log, a build artefact, or the repo working directory on the server.
- Any change to firewall rules, SSH config, TLS, or backup jobs requires human approval before it is applied.
'@

# ---------------------------------------------------------------- gitattributes / gitignore

Write-Step "Writing .gitattributes"
$ga = Join-Path $root '.gitattributes'
if (-not (Test-Path $ga) -or $Force) {
@'
# Developed on Windows, deployed to a Linux VPS. Normalise to LF for
# everything that ships, keep CRLF for local PowerShell scripts, and
# stop git from printing an LF/CRLF advisory on every `git add`.
* text=auto eol=lf
*.ps1 text eol=crlf
'@ | Set-Content -Path $ga -Encoding UTF8
    Write-Ok ".gitattributes written"
}

Write-Step "Writing .gitignore"
$gi = Join-Path $root '.gitignore'
if (-not (Test-Path $gi) -or $Force) {
@'
node_modules/
.next/
out/
.env
.env.*
!.env.example
*.local
coverage/
.DS_Store
Thumbs.db

# never commit these
*.pem
*.key
id_ed25519*
infra/**/*.secret
infra/**/inventory.local*
'@ | Set-Content -Path $gi -Encoding UTF8
    Write-Ok ".gitignore written"
}

# ---------------------------------------------------------------- commit

Write-Step "Initial commit"
git add -A

# git exits non-zero for both "repo has no commits yet, checking HEAD" style
# probes and "nothing to commit". Under $ErrorActionPreference = 'Stop',
# PowerShell 7.3+ turns that non-zero exit into a terminating error on its
# own, regardless of stream redirection. Drop to 'Continue' for just this
# call, read $LASTEXITCODE ourselves, then restore it.
$prevEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
git commit -m "chore: bootstrap spec-driven scaffold (Spec Kit, AGENTS.md, Cursor rules, infra skeleton)" 2>&1 | Out-Null
$commitExit = $LASTEXITCODE
$ErrorActionPreference = $prevEAP

if ($commitExit -eq 0) {
    Write-Ok "committed"
} else {
    Write-Warn "nothing new to commit (working tree already matches HEAD, or this is a re-run)"
}

# ---------------------------------------------------------------- next steps

Write-Host @"

Done. Repo root: $root

Next:

  1. Copy amend-prd-v1.1.md to docs/prd/amend-prd.md
     Copy ADR-0001-dreamhost-hosting.md to docs/decisions/
  2. Open $root in Cursor.
  3. Agent mode: /speckit-constitution   (paste constitution.md)
  4. Agent mode: /speckit-specify        (slice 0: infrastructure)

Slice 0 is the infrastructure slice and it comes first. The resource library
(slice 3) cannot be specified until the DreamObjects bucket exists, and nothing
can be deployed until the VPS is provisioned and hardened.

Two blockers before you provision:
  - PRD Q13 (data residency). DreamHost is US-only. An EU requirement conflicts
    with the hosting direction and must be resolved first.
  - PRD Q17 (named owner for patching, backup verification, incident response).
    Self-managed hosting moves these from a vendor to a person.

"@ -ForegroundColor White
