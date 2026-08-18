import type {
  Announcement,
  BlogPost,
  EventItem,
  ForumActivity,
  ForumThread,
  Member,
  Resource } from
'../types/portal';

export const currentMember: Member = {
  name: 'Dana Whitfield',
  initials: 'DW',
  role: 'Trainer',
  region: 'Midwest region',
  memberSince: 'Member since 2019'
};

export const announcement: Announcement = {
  id: 'ann-1',
  kind: 'action',
  title: '2026 credential renewals open through 12 September',
  body: 'Trainers delivering the Core Practice curriculum must submit renewal documentation before the autumn cohort begins. Renewals take about ten minutes.',
  postedAt: 'Posted 14 August',
  actionLabel: 'Start renewal'
};

export const events: EventItem[] = [
{
  id: 'ev-1',
  title: 'De-escalation refresher: working with acute distress',
  format: 'Online',
  day: '21',
  month: 'Aug',
  weekday: 'Thursday',
  time: '10:00–12:30 CT',
  location: 'Live session, recording provided',
  seatsNote: '9 of 40 seats remaining',
  registered: true,
  access: 'all'
},
{
  id: 'ev-2',
  title: 'Regional trainer roundtable — Midwest',
  format: 'In person',
  day: '28',
  month: 'Aug',
  weekday: 'Thursday',
  time: '09:00–16:00 CT',
  location: 'Springfield Community Center',
  seatsNote: 'Travel stipend available',
  registered: false,
  access: 'trainers'
},
{
  id: 'ev-3',
  title: 'Reentry planning with families: practice clinic',
  format: 'Hybrid',
  day: '04',
  month: 'Sep',
  weekday: 'Thursday',
  time: '13:00–15:00 CT',
  location: 'Online or Columbus field office',
  seatsNote: 'Open to all members',
  registered: false,
  access: 'all'
},
{
  id: 'ev-4',
  title: 'Supporting staff after a critical incident',
  format: 'Online',
  day: '17',
  month: 'Sep',
  weekday: 'Wednesday',
  time: '11:00–12:00 CT',
  location: 'Live session, no recording',
  seatsNote: 'Registration opens 25 August',
  registered: false,
  access: 'all'
}];


export const resources: Resource[] = [
{
  id: 'res-1',
  title: 'Core Practice facilitator guide, 4th edition',
  preview:
  'Session-by-session facilitation notes, timing guidance, and debrief prompts for the twelve-module Core Practice curriculum.',
  format: 'PDF',
  source: 'National office',
  tags: ['Curriculum', 'Facilitation'],
  updated: 'Updated 6 August 2026',
  size: '4.2 MB',
  access: 'trainers'
},
{
  id: 'res-2',
  title: 'Trauma-informed communication pocket card',
  preview:
  'Two-sided card with grounding language, questions to avoid, and handoff phrasing. Sized for a lanyard sleeve.',
  format: 'Template',
  source: 'National office',
  tags: ['Trauma-informed', 'Frontline'],
  updated: 'Updated 22 July 2026',
  size: '380 KB',
  access: 'all'
},
{
  id: 'res-3',
  title: 'Peer support program: start-up toolkit',
  preview:
  'Charter templates, confidentiality agreements, supervisor briefing deck, and a twelve-week rollout checklist.',
  format: 'Toolkit',
  source: 'Field practice network',
  tags: ['Peer support', 'Program design'],
  updated: 'Updated 11 July 2026',
  size: '18 MB',
  access: 'all'
},
{
  id: 'res-4',
  title: 'Recognising cumulative stress in your unit',
  preview:
  'Forty-minute recorded session with Dr. Ana Reyes on early indicators, supervisor conversations, and referral pathways.',
  format: 'Video',
  source: 'Partner research',
  tags: ['Wellbeing', 'Supervision'],
  updated: 'Added 28 June 2026',
  size: '42 min',
  access: 'all'
},
{
  id: 'res-5',
  title: 'Family visitation orientation slides',
  preview:
  'Editable deck for onboarding volunteers and new staff to visitation protocol, with plain-language speaker notes.',
  format: 'Slides',
  source: 'Field practice network',
  tags: ['Reentry', 'Volunteers'],
  updated: 'Updated 19 June 2026',
  size: '6.8 MB',
  access: 'all'
},
{
  id: 'res-6',
  title: 'Chapter budget and stipend request forms',
  preview:
  'Fiscal year 2026 forms for regional chapter leads, including travel reimbursement and interpreter cost lines.',
  format: 'Template',
  source: 'National office',
  tags: ['Administration'],
  updated: 'Updated 2 June 2026',
  size: '210 KB',
  access: 'leadership'
}];


export const resourceTags: string[] = [
'Curriculum',
'Trauma-informed',
'Peer support',
'Wellbeing',
'Reentry',
'Supervision',
'Administration'];


export const resourceSources: string[] = [
'National office',
'Field practice network',
'Partner research'];


export const forumCategory = {
  slug: 'frontline-practice',
  name: 'Frontline practice',
  description:
  'Day-to-day practice questions from members working inside facilities. Please keep posts free of identifying details about the people you serve.',
  threadCount: 148,
  memberCount: 612,
  moderator: 'Moderated by Lucia Ferrante'
};

export const forumThreads: ForumThread[] = [
{
  id: 'th-1',
  title: 'Community guidelines and what not to post here',
  excerpt:
  'Before posting, please read our confidentiality expectations. Posts containing names, case numbers, or facility incident details will be removed.',
  author: 'Lucia Ferrante',
  role: 'Coordinator',
  replies: 4,
  lastActivity: '12 May',
  pinned: true,
  locked: true
},
{
  id: 'th-2',
  title: 'Monthly practice thread: what worked on your unit in August?',
  excerpt:
  'Short entries welcome. One thing you tried, one thing you would change. I collate these for the quarterly practice note.',
  author: 'Lucia Ferrante',
  role: 'Coordinator',
  replies: 31,
  lastActivity: '2 hours ago',
  pinned: true
},
{
  id: 'th-3',
  title: 'Running a group session when the room keeps getting pulled for count',
  excerpt:
  'Our sessions get interrupted two or three times an hour. Curious how others structure modules around unpredictable interruptions.',
  author: 'Marcus Bell',
  role: 'Program staff',
  replies: 17,
  lastActivity: '4 hours ago',
  pinned: false,
  unread: true
},
{
  id: 'th-4',
  title: 'Language for declining a request without escalating things',
  excerpt:
  'Looking for phrasing that stays warm but firm. The pocket card helps, though I struggle when someone has already been told no twice.',
  author: 'Priya Raman',
  role: 'Chaplain',
  replies: 23,
  lastActivity: 'Yesterday',
  pinned: false,
  unread: true
},
{
  id: 'th-5',
  title: 'Handover notes between shifts — what actually gets read?',
  excerpt:
  'We moved to a one-page template last quarter. Adoption is uneven. Has anyone found a format that survives a busy shift change?',
  author: 'Tom Okafor',
  role: 'Officer',
  replies: 9,
  lastActivity: 'Yesterday',
  pinned: false
},
{
  id: 'th-6',
  title: 'Debriefing yourself after a hard week when no formal support exists',
  excerpt:
  'My facility has no peer support program yet. In the meantime, what do people do to close out a week so it does not follow them home?',
  author: 'Sandra Iversen',
  role: 'Program staff',
  replies: 48,
  lastActivity: '2 days ago',
  pinned: false
},
{
  id: 'th-7',
  title: 'Interpreter access for family sessions: how are you covering costs?',
  excerpt:
  'Our stipend line does not stretch to interpreters. Interested in how other chapters have handled this with their facility partners.',
  author: 'Elena Duarte',
  role: 'Trainer',
  replies: 6,
  lastActivity: '3 days ago',
  pinned: false
}];


export const forumActivity: ForumActivity[] = [
{
  id: 'fa-1',
  category: 'Frontline practice',
  title: 'Running a group session when the room keeps getting pulled for count',
  author: 'Marcus Bell',
  role: 'Program staff',
  replies: 17,
  lastActivity: '4 hours ago'
},
{
  id: 'fa-2',
  category: 'Wellbeing',
  title: 'Debriefing yourself after a hard week when no formal support exists',
  author: 'Sandra Iversen',
  role: 'Program staff',
  replies: 48,
  lastActivity: '2 days ago'
},
{
  id: 'fa-3',
  category: 'Trainers’ room',
  title: 'Adapting module 7 for a group with mixed reading levels',
  author: 'Elena Duarte',
  role: 'Trainer',
  replies: 12,
  lastActivity: '2 days ago'
}];


export const blogPosts: BlogPost[] = [
{
  id: 'bp-1',
  title: 'What 600 members told us about burnout this year',
  author: 'Research team',
  readTime: '6 min read',
  publishedAt: '11 August'
},
{
  id: 'bp-2',
  title: 'A chaplain on the first ten minutes of any conversation',
  author: 'Priya Raman',
  readTime: '4 min read',
  publishedAt: '29 July'
},
{
  id: 'bp-3',
  title: 'Why we retired the phrase “difficult population”',
  author: 'Lucia Ferrante',
  readTime: '3 min read',
  publishedAt: '18 July'
}];