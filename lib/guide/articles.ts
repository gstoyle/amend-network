import type { GuideArticle } from "@/lib/guide/types";

export const GUIDE_ARTICLES: GuideArticle[] = [
  {
    slug: "signing-in",
    title: "Sign in and request access",
    summary: "How to get an account, sign in, reset a password, and what happens while you wait for approval.",
    category: "start",
    audience: "member",
    keywords: ["login", "password", "register", "invite", "pending", "mfa"],
    blocks: [
      {
        type: "p",
        text: "This network is private. You only reach member pages after you have an approved account and an active session. There is no “remember me” option, because devices are often shared.",
      },
      { type: "h2", id: "request-access", text: "Request access" },
      {
        type: "steps",
        items: [
          {
            title: "Open Request access",
            text: "From the public home page or the sign-in screen, choose Request access.",
          },
          {
            title: "Complete the form",
            text: "Use a working email address. Choose your programme when asked. DOC affiliation is selected from the list Amend maintains — do not invent a value.",
          },
          {
            title: "Wait for review",
            text: "A pending account can sign in, but it only sees the holding page until staff approve or deny the request. You will not see Resources, Events, Forum, or Directory until that happens.",
          },
        ],
      },
      {
        type: "callout",
        tone: "note",
        title: "Invites",
        text: "Staff can also send an invite link. Completing an invite still creates an account that staff must approve unless they have already set you as active.",
      },
      { type: "h2", id: "sign-in", text: "Sign in" },
      {
        type: "ol",
        items: [
          "Go to Sign in and enter the email and password for this network.",
          "If you hold an administrative role, complete MFA enrollment or the MFA challenge when prompted. Members without an admin role are not asked for MFA.",
          "Approved members land on Home. Pending members land on the holding page.",
        ],
      },
      { type: "h2", id: "password", text: "If you forget your password" },
      {
        type: "p",
        text: "Use Forgot password on the sign-in screen. The product always shows the same confirmation, whether or not that email exists, so an observer cannot tell which addresses are registered. If a reset email arrives, follow the link promptly — tokens expire.",
      },
      {
        type: "links",
        items: [
          { href: "/login", label: "Sign in", description: "Email and password." },
          { href: "/register", label: "Request access", description: "New membership request." },
          { href: "/forgot-password", label: "Forgot password", description: "Request a reset email." },
        ],
      },
    ],
  },
  {
    slug: "finding-your-way",
    title: "Finding your way around",
    summary: "Primary navigation, the account menu, announcements, and the reserved public-writing column on Home.",
    category: "start",
    audience: "member",
    keywords: ["nav", "home", "sidebar", "tabs", "announcements", "guide"],
    blocks: [
      {
        type: "p",
        text: "On a phone, primary destinations sit in the bottom bar. On a larger screen they sit in the left sidebar. The current section is marked with more than colour — the current link is announced to assistive technology.",
      },
      { type: "h2", id: "primary", text: "Primary destinations" },
      {
        type: "ul",
        items: [
          "Home — greetings, upcoming events, recent resources, recent forum activity, and announcements.",
          "Resources — the library of files and videos your role may open.",
          "Events — the training calendar and RSVP list.",
          "Forum — discussion rooms your role may see.",
          "Directory — members who chose to appear.",
          "Guide — this handbook.",
        ],
      },
      {
        type: "p",
        text: "Account actions (directory privacy, active sessions, and log out) live in the account area, not in the bottom bar. If you have an administrative role, Admin appears there as well. You are never asked to pick a “member mode” or an “admin mode”.",
      },
      { type: "h2", id: "announcements", text: "Announcements" },
      {
        type: "p",
        text: "Time-bounded banners can appear at the top of member pages. A banner you dismiss stays dismissed for you. Visibility still follows your roles — a Pathways-only announcement is not shown to a LEAD-only member.",
      },
      {
        type: "callout",
        tone: "note",
        title: "Public writing",
        text: "Home keeps a labelled reserved panel for Amend’s public blog. That feed is not connected yet. A reserved panel is not a broken link and not a loading skeleton.",
      },
      {
        type: "links",
        items: [
          { href: "/app", label: "Home" },
          { href: "/app/guide", label: "Guide index" },
        ],
      },
    ],
  },
  {
    slug: "shared-devices",
    title: "Shared devices and signing out",
    summary: "Sessions close with the browser, can be revoked remotely, and should be ended on computers other people use.",
    category: "start",
    audience: "member",
    keywords: ["session", "logout", "shared", "computer", "cookie"],
    blocks: [
      {
        type: "p",
        text: "Shared kiosks and borrowed laptops are expected. The product is built so a later person at the same browser should not inherit your session.",
      },
      { type: "h2", id: "how-sessions-end", text: "How sessions end" },
      {
        type: "ul",
        items: [
          "Closing the browser ends the session cookie.",
          "A sliding window of 24 hours also expires idle sessions.",
          "You can revoke other devices from Active sessions without signing yourself out.",
          "Log out from the account area ends this device immediately.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Before you walk away",
        text: "Use Log out on a shared computer. Do not leave Home sitting on screen. Do not save the password in a browser profile other people can open.",
      },
      {
        type: "links",
        items: [
          {
            href: "/app/profile/sessions",
            label: "Active sessions",
            description: "See other devices and revoke them.",
          },
        ],
      },
    ],
  },
  {
    slug: "resources",
    title: "Resources",
    summary: "Search and filter the library, open a file or video, and understand why some items do not appear.",
    category: "library",
    audience: "member",
    keywords: ["pdf", "download", "video", "library", "filter", "tag"],
    blocks: [
      {
        type: "p",
        text: "Resources is the library. You only see items whose visibility includes at least one of your roles. Staff see a wider set because they hold administrative roles as well as, in some cases, a programme role.",
      },
      { type: "h2", id: "find", text: "Find an item" },
      {
        type: "ul",
        items: [
          "Search by words in the title or description.",
          "Filter by source and by topic tags.",
          "Sort by newest or other offered sorts.",
          "Clear filters returns the full list you are allowed to see.",
        ],
      },
      { type: "h2", id: "open", text: "Open or download" },
      {
        type: "p",
        text: "Open the item for a preview. Files download through an authenticated route — you will not be handed a public object-storage URL. Videos play in the page when a playback link exists.",
      },
      {
        type: "callout",
        tone: "note",
        title: "If an item is missing",
        text: "That usually means it is not published to your programme, it expired, or it was never meant for all authenticated members. The product will not explain which of those is true.",
      },
      {
        type: "links",
        items: [{ href: "/app/resources", label: "Resources" }],
      },
    ],
  },
  {
    slug: "events",
    title: "Events",
    summary: "Read the calendar, RSVP, download a calendar file, and join an online session when a link is available.",
    category: "library",
    audience: "member",
    keywords: ["calendar", "rsvp", "ics", "zoom", "capacity"],
    blocks: [
      {
        type: "p",
        text: "Events lists sessions your membership may see. Switch between calendar and list views. Times are shown in a way that stays readable if the server and your clock disagree on zone.",
      },
      { type: "h2", id: "rsvp", text: "RSVP" },
      {
        type: "steps",
        items: [
          { title: "Open the event", text: "Choose it from the list or the calendar." },
          {
            title: "Record your response",
            text: "Use the RSVP control. Capacity, if set, can prevent further Yes answers once the event is full.",
          },
          {
            title: "Add it to your own calendar",
            text: "Download the calendar file from the event page if you keep a separate calendar.",
          },
        ],
      },
      {
        type: "p",
        text: "Online events may reveal a join link after you are allowed to see it. Treat that link as confidential. Do not post it in the forum.",
      },
      {
        type: "links",
        items: [{ href: "/app/events", label: "Events" }],
      },
    ],
  },
  {
    slug: "forum",
    title: "Forum",
    summary: "Rooms, posting, editing, flags, subscriptions, and the limits the product enforces.",
    category: "community",
    audience: "member",
    keywords: ["thread", "post", "flag", "subscribe", "markdown", "lock"],
    blocks: [
      {
        type: "p",
        text: "The forum is a professional space. You only see categories whose visibility matches your roles. Staff can see every category so they can moderate.",
      },
      { type: "h2", id: "rooms", text: "Rooms and threads" },
      {
        type: "ul",
        items: [
          "Open Forum to see categories, then a category to see threads, then a thread to read posts.",
          "Threads are two-level: the thread plus a flat list of posts. There are no nested replies and no @-mentions.",
          "Pinned threads stay at the top of a category. Locked threads cannot take new replies.",
        ],
      },
      { type: "h2", id: "write", text: "Writing a post" },
      {
        type: "ul",
        items: [
          "Use allowlisted markdown only: bold, italics, and links that start with http, https, or /app/. Raw HTML is rejected.",
          "There are no image uploads in the forum.",
          "You may edit your own post for 15 minutes. After that, only staff can change it.",
          "Rate limits for members: one new thread per minute, five posts per minute, thirty posts per hour. Staff are exempt. If you hit a limit, the product says to try again later.",
        ],
      },
      { type: "h2", id: "subscribe-flag", text: "Subscribe and flag" },
      {
        type: "p",
        text: "Subscribe to a thread to get email when someone else replies. Every notification includes an unsubscribe link. Flag a post that is harmful, harassing, or off-mission — staff review an open flag queue.",
      },
      {
        type: "callout",
        tone: "warning",
        title: "Names in the forum",
        text: "Authors show as first name plus last initial, or “Member” if a name is missing. Do not paste other people’s contact details into a post.",
      },
      {
        type: "links",
        items: [
          { href: "/app/forum", label: "Forum" },
          { href: "/community-guidelines", label: "Community guidelines" },
        ],
      },
    ],
  },
  {
    slug: "directory",
    title: "Directory and privacy",
    summary: "Who appears, which fields you control, and how search treats hidden fields.",
    category: "community",
    audience: "member",
    keywords: ["privacy", "opt-in", "listing", "email", "doc", "title"],
    blocks: [
      {
        type: "p",
        text: "The directory is opt-in. You do not appear until you choose to. Name and network are visible on a listing; title, DOC affiliation, and email stay hidden unless you turn each one on.",
      },
      { type: "h2", id: "search", text: "Search" },
      {
        type: "p",
        text: "Search uses name, and only the optional fields that person has shown. A hidden title or DOC affiliation cannot be used to find them. You see people in your programme who opted in. Staff who may view both programmes still do not see a field the member hid.",
      },
      { type: "h2", id: "privacy", text: "Your privacy controls" },
      {
        type: "ol",
        items: [
          "Open Directory privacy from the account area.",
          "Choose whether you appear at all.",
          "Turn on title, DOC affiliation, or email only if you want every allowed viewer — including staff in the directory — to see that field.",
        ],
      },
      {
        type: "callout",
        tone: "note",
        title: "First visit",
        text: "If you have not set privacy yet, Home and Directory remind you. Setting it is not the same as appearing: you can save hidden defaults and still stay off the list.",
      },
      {
        type: "links",
        items: [
          { href: "/app/directory", label: "Directory" },
          { href: "/app/profile/privacy", label: "Directory privacy" },
        ],
      },
    ],
  },
  {
    slug: "your-account",
    title: "Your account",
    summary: "Roles, MFA for staff, sessions, and why the product never asks you to prove a role in the browser.",
    category: "account",
    audience: "member",
    keywords: ["role", "pathways", "lead", "mfa", "admin", "session"],
    blocks: [
      {
        type: "p",
        text: "You hold exactly one programme role (Pathways, LEAD, or none) and zero or one administrative role. Role checks run on the server from the signed session. A value typed into the page cannot raise your access.",
      },
      { type: "h2", id: "what-you-see", text: "What you can see" },
      {
        type: "ul",
        items: [
          "Pathways members see Pathways-visible and all-authenticated content.",
          "LEAD members see LEAD-visible and all-authenticated content.",
          "Staff with an administrative role also reach Admin from the account area, after MFA.",
        ],
      },
      { type: "h2", id: "mfa", text: "MFA for administrative work" },
      {
        type: "p",
        text: "If your account has an administrative role, you enroll a TOTP app and enter a code before admin pages. Member pages do not require that challenge. Losing the authenticator is an operations issue — staff reset it; the product will not email a bypass code.",
      },
      {
        type: "links",
        items: [
          { href: "/app/profile/privacy", label: "Directory privacy" },
          { href: "/app/profile/sessions", label: "Active sessions" },
        ],
      },
    ],
  },
  {
    slug: "if-something-goes-wrong",
    title: "If something goes wrong",
    summary: "Generic errors, missing pages, and how to get help without sharing passwords.",
    category: "account",
    audience: "member",
    keywords: ["error", "help", "support", "flag", "password"],
    blocks: [
      {
        type: "p",
        text: "When a sign-in or form fails, the product uses a generic message. It will not tell you whether an email exists, whether a password was wrong, or why an account was denied. That is deliberate.",
      },
      { type: "h2", id: "common", text: "Common situations" },
      {
        type: "ul",
        items: [
          "Holding page after sign-in — your request is still pending.",
          "Empty library or calendar — nothing is published to your roles yet, or filters are too narrow.",
          "Forum says to try again later — a rate limit. Wait a minute (or up to an hour if you posted heavily).",
          "A thread will not accept replies — it is locked, or you cannot see that category.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Never send a password",
        text: "Amend staff will not ask you to paste a password, MFA secret, or reset link into email or the forum. If a message asks for that, do not follow it.",
      },
      {
        type: "p",
        text: "For harmful forum content, flag the post. For account or access problems, contact the programme staff who invited you to this network.",
      },
    ],
  },
  {
    slug: "staff-overview",
    title: "Staff overview",
    summary: "How the admin overlay works, who can open which tools, and that MFA is required on admin routes.",
    category: "staff",
    audience: "staff",
    keywords: ["admin", "moderator", "mfa", "overlay"],
    blocks: [
      {
        type: "p",
        text: "Administrative tools sit alongside the member experience. Open Admin from the account area. Member destinations stay in the primary nav so you are not forced into a separate skin.",
      },
      { type: "h2", id: "who", text: "Who can open what" },
      {
        type: "ul",
        items: [
          "Moderators reach Admin home and Forum moderation. They do not get analytics, audit log, resource publishing, announcements, or user invite/approval.",
          "Admins and Super Admins reach the content and user tools listed in the admin nav.",
          "Event publishing follows event staff roles, which may include moderators when that route allows it.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "MFA",
        text: "Admin pages require a satisfied MFA claim. If you skip the challenge, the route denies you the same way an unauthorized role would.",
      },
      {
        type: "links",
        items: [{ href: "/admin", label: "Admin home" }],
      },
    ],
  },
  {
    slug: "publishing",
    title: "Publishing resources, events, and announcements",
    summary: "Visibility tokens, authenticated downloads, and keeping PII out of analytics.",
    category: "staff",
    audience: "content_admin",
    keywords: ["publish", "visibility", "announcement", "resource", "event"],
    blocks: [
      {
        type: "p",
        text: "Content visibility is a list of tokens: all authenticated members, Pathways, and/or LEAD. Do not invent a special-case role branch in a page. If someone cannot see an item, it is because their roles do not intersect that list.",
      },
      { type: "h2", id: "resources-events", text: "Resources and events" },
      {
        type: "ul",
        items: [
          "Publish from Admin → Resources or Admin → Events.",
          "Files stay in the private bucket. Members download through the app, never a durable public URL.",
          "Events can carry capacity, location or virtual flags, and a join URL revealed only to people allowed to see the event.",
        ],
      },
      { type: "h2", id: "announcements", text: "Announcements" },
      {
        type: "p",
        text: "Banners are time-bounded and visibility-gated. Members may dismiss a banner for themselves. Keep copy free of other members’ personal data.",
      },
      {
        type: "callout",
        tone: "warning",
        title: "Analytics",
        text: "Product analytics may receive opaque ids and role labels only. Never send names, emails, or post bodies to that stream.",
      },
    ],
  },
  {
    slug: "forum-moderation",
    title: "Forum moderation",
    summary: "Flags, hide, delete, lock, pin, and who may create categories.",
    category: "staff",
    audience: "staff",
    keywords: ["flag", "hide", "delete", "lock", "pin", "category"],
    blocks: [
      {
        type: "p",
        text: "Moderators, Admins, and Super Admins can hide or delete posts and lock or pin threads. Category create is limited to Admin and Super Admin.",
      },
      { type: "h2", id: "queue", text: "Flag queue" },
      {
        type: "p",
        text: "Open Admin → Forum → Flags. Keep a flagged post or hide/delete it. Actions are audited. Corrections are new audit rows — the log is append-only.",
      },
      {
        type: "ul",
        items: [
          "Hide — the post is withheld from members; staff can still see it in moderation context as the product allows.",
          "Delete — the post is removed from member view according to the forum rules.",
          "Lock — no new replies.",
          "Pin — the thread stays at the top of its category.",
        ],
      },
      {
        type: "callout",
        tone: "note",
        title: "Harm",
        text: "Escalation for harm sits with programme staff. The product records the moderation action; it does not replace that policy.",
      },
      {
        type: "links",
        items: [
          { href: "/admin/forum", label: "Forum admin" },
          { href: "/admin/forum/flags", label: "Flag queue" },
        ],
      },
    ],
  },
  {
    slug: "members-and-invites",
    title: "Approving members and sending invites",
    summary: "Pending queue, invites, and role assignment without trusting the browser.",
    category: "staff",
    audience: "content_admin",
    keywords: ["pending", "invite", "approve", "deny", "role"],
    blocks: [
      {
        type: "p",
        text: "Admins and Super Admins review registration requests and send invites. Moderators do not.",
      },
      {
        type: "ul",
        items: [
          "Pending users — approve or deny. Denied accounts cannot use the member app.",
          "Invite — send a link for a known person. Still do not put secrets in the invite body beyond what the product generates.",
          "Assign programme and administrative roles on the server tools provided. Do not ask a user to “set themselves as admin”.",
        ],
      },
      {
        type: "links",
        items: [
          { href: "/admin/users/pending", label: "Pending users" },
          { href: "/admin/users/invite", label: "Invite" },
        ],
      },
    ],
  },
  {
    slug: "analytics-and-audit",
    title: "Analytics and the audit log",
    summary: "What the dashboards count, k-anonymity on leaderboards, and how to read the append-only log.",
    category: "staff",
    audience: "content_admin",
    keywords: ["analytics", "audit", "kpi", "export"],
    blocks: [
      {
        type: "p",
        text: "Analytics is for operating the programme, not ranking members. Leaderboards omit a named resource or event when its count is below 3, then cap remaining rows. KPI totals are not k-filtered.",
      },
      {
        type: "ul",
        items: [
          "Open Admin → Analytics for KPIs and funnels.",
          "Open Admin → Audit log to read actions. Export, where offered, follows the same role rules as the viewer.",
          "You cannot edit or delete an audit row. A correction is a new row.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "No PII in product analytics",
        text: "If you are investigating a person, use the audit log and member tools — not a spreadsheet of PostHog properties that might contain names.",
      },
      {
        type: "links",
        items: [
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/admin/audit-log", label: "Audit log" },
        ],
      },
    ],
  },
];
