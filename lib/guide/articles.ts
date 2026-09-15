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
            text: "Use a working email address. Choose International Immersion Program or LEAD when asked. DOC affiliation is selected from the list Amend maintains — do not invent a value.",
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
          "If you hold an administrative role, you can set up an authenticator from the account menu. MFA is optional for now; members without an admin role are not asked for it.",
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
          "Home — greetings, upcoming events, recent resources, recent forum activity (after you join the directory), and announcements.",
          "Resources — the library of files and videos your role may open.",
          "Events — the training calendar and RSVP list.",
          "Forum — discussion rooms your role may see, after you join the directory.",
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
        text: "Time-bounded banners can appear at the top of member pages. A banner you dismiss stays dismissed for you. Visibility still follows your roles — an Immersion-only announcement is not shown to a LEAD-only member.",
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
    summary: "Two collections, folders, search, and why some items do not appear.",
    category: "library",
    audience: "member",
    keywords: ["pdf", "download", "video", "library", "filter", "tag", "folder", "amend"],
    blocks: [
      {
        type: "p",
        text: "Resources is the library. You only see items whose visibility includes at least one of your roles. The library has two collections: From Amend (materials Amend stands behind) and Shared by members (peer files, not an endorsement). Members cannot upload; staff publish both collections.",
      },
      { type: "h2", id: "find", text: "Find an item" },
      {
        type: "ul",
        items: [
          "The library is split into From Amend and Shared by members.",
          "Folders nest one level, for example Policies and then a location.",
          "Search by words in the title or description.",
          "Filter by collection, folder, and topic tags.",
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
    summary: "Named programme rooms, directory listing required, formatting, flags, and subscriptions.",
    category: "community",
    audience: "member",
    keywords: ["thread", "post", "flag", "subscribe", "markdown", "lock", "directory", "name"],
    blocks: [
      {
        type: "p",
        text: "The forum is a professional space. You only see programme rooms that match your roles, and only after you join the member directory. Posts show your first name and last initial — there is no anonymous “Member” byline. The all-members room is paused until Amend has moderation capacity. Staff can still see paused rooms in Forum admin and can moderate without listing themselves.",
      },
      { type: "h2", id: "rooms", text: "Rooms and threads" },
      {
        type: "ul",
        items: [
          "Join the directory from Directory privacy, then open Forum to see programme rooms, a room to see threads, and a thread to read posts. There is no all-members room at launch.",
          "Threads are two-level: the thread plus a flat list of posts. There are no nested replies and no @-mentions.",
          "Pinned threads stay at the top of a category. Locked threads cannot take new replies.",
          "Staff comments use the same name style as members. There is no Amend badge, and the name is not a directory link.",
        ],
      },
      { type: "h2", id: "write", text: "Writing a post" },
      {
        type: "ul",
        items: [
          "Use the formatting buttons for bold, italic, underline, and links (http, https, or /app/). Raw HTML is rejected.",
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
        text: "Authors show as first name plus last initial. Joining the directory is required to read or post. Turning listing off later removes forum access; older posts keep the name they were published with. Do not paste other people’s contact details into a post.",
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
    summary: "Opt-in listing, forum access, hidden fields, and who can see you.",
    category: "community",
    audience: "member",
    keywords: ["privacy", "opt-in", "listing", "email", "doc", "title", "forum"],
    blocks: [
      {
        type: "p",
        text: "The directory is opt-in. You do not appear until you choose to. Name and network are visible on a listing; title, DOC affiliation, and email stay hidden unless you turn each one on. Joining the directory is also how members get access to the forum. Staff-only Amend accounts (no Immersion or LEAD programme) cannot appear — the directory is for members, not an org chart.",
      },
      { type: "h2", id: "search", text: "Search" },
      {
        type: "p",
        text: "Search uses name, and only the optional fields that person has shown. A hidden title or DOC affiliation cannot be used to find them. You see people in your programme who opted in. If you belong to both Immersion and LEAD, you see listed people from both. Staff who may view both programmes still do not see a field the member hid.",
      },
      { type: "h2", id: "privacy", text: "Your privacy controls" },
      {
        type: "ol",
        items: [
          "Open Directory privacy from the account area.",
          "Choose whether you appear at all. Appearing is required to use the forum.",
          "Turn on title, DOC affiliation, or email only if you want every allowed viewer — including staff in the directory — to see that field.",
        ],
      },
      {
        type: "callout",
        tone: "note",
        title: "First visit",
        text: "If you have not set privacy yet, Home and Directory remind you. Setting it is not the same as appearing: you can save hidden defaults and still stay off the list — and off the forum until you appear.",
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
    keywords: ["role", "immersion", "pathways", "lead", "mfa", "admin", "session", "dual"],
    blocks: [
      {
        type: "p",
        text: "Most members belong to one programme (International Immersion Program or LEAD). Some people are in both. You may also have zero or one administrative role. Role checks run on the server from the signed session. A value typed into the page cannot raise your access.",
      },
      { type: "h2", id: "what-you-see", text: "What you can see" },
      {
        type: "ul",
        items: [
          "International Immersion Program members see Immersion-only items and items published for all members.",
          "LEAD members see LEAD-only items and items published for all members.",
          "Members of both programmes see Immersion and LEAD items.",
          "Forum rooms are programme-only at launch. Join the directory to use them.",
          "Staff with an administrative role also reach Admin from the account area. Authenticator setup is optional.",
        ],
      },
      { type: "h2", id: "mfa", text: "MFA for administrative work" },
      {
        type: "p",
        text: "If your account has an administrative role, you can optionally enroll a TOTP app from Set up authenticator. Admin pages do not currently require that challenge. Losing the authenticator is an operations issue — staff reset it; the product will not email a bypass code.",
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
          "Forum asks you to join the directory — appear in the directory from Directory privacy, then return.",
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
    summary: "How the admin overlay works, who can open which tools, and that authenticator setup is optional.",
    category: "staff",
    audience: "staff",
    keywords: ["admin", "moderator", "mfa", "overlay", "directory"],
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
          "Staff-only accounts are not listed in the member directory. You can still moderate and post; comments show your first name and last initial, the same as members.",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "MFA",
        text: "Authenticator setup is optional. Admin pages currently allow a signed-in administrative role without a satisfied MFA claim. You can still enroll from Set up authenticator in the account menu.",
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
    keywords: ["publish", "visibility", "announcement", "resource", "event", "folder", "collection"],
    blocks: [
      {
        type: "p",
        text: "Content visibility is a list of tokens: all authenticated members, International Immersion Program, and/or LEAD. Do not invent a special-case role branch in a page. If someone cannot see an item, it is because their roles do not intersect that list.",
      },
      { type: "h2", id: "resources-events", text: "Resources and events" },
      {
        type: "ul",
        items: [
          "Publish from Admin → Resources or Admin → Events.",
          "Choose From Amend (endorsed) or Shared by members (not an endorsement). Members cannot upload; staff publish both.",
          "Folders nest one level (for example Policies, then a location). Topic tags are optional.",
          "Resources, events, and announcements may still be visible to all members. New forum rooms cannot — the all-members room is paused.",
          "Files stay private. Members download through the app, never a lasting public file link.",
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
    keywords: ["flag", "hide", "delete", "lock", "pin", "category", "directory", "paused"],
    blocks: [
      {
        type: "p",
        text: "Moderators, Admins, and Super Admins can hide or delete posts and lock or pin threads. Category create is limited to Admin and Super Admin. New rooms are Immersion and/or LEAD only — the all-members room is paused. Members must join the directory to read or post. Staff can moderate and post without listing. Every byline is first name plus last initial; there is no anonymous label.",
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
          "Assign International Immersion Program and/or LEAD, plus administrative roles, on the server tools provided. Do not ask a user to “set themselves as admin”. A person can belong to both programmes.",
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
