export type MemberRole = 'Trainer' | 'Chaplain' | 'Program staff' | 'Officer' | 'Coordinator';

export type AccessLevel = 'all' | 'trainers' | 'leadership';

export type Member = {
  name: string;
  initials: string;
  role: MemberRole;
  region: string;
  memberSince: string;
};

export type Announcement = {
  id: string;
  kind: 'notice' | 'action' | 'update';
  title: string;
  body: string;
  postedAt: string;
  actionLabel: string;
};

export type EventItem = {
  id: string;
  title: string;
  format: 'In person' | 'Online' | 'Hybrid';
  day: string;
  month: string;
  weekday: string;
  time: string;
  location: string;
  seatsNote: string;
  registered: boolean;
  access: AccessLevel;
};

export type ResourceFormat = 'PDF' | 'Toolkit' | 'Video' | 'Slides' | 'Template';

export type Resource = {
  id: string;
  title: string;
  preview: string;
  format: ResourceFormat;
  source: string;
  tags: string[];
  updated: string;
  size: string;
  access: AccessLevel;
};

export type ForumThread = {
  id: string;
  title: string;
  excerpt: string;
  author: string;
  role: MemberRole;
  replies: number;
  lastActivity: string;
  pinned: boolean;
  locked?: boolean;
  unread?: boolean;
};

export type ForumActivity = {
  id: string;
  category: string;
  title: string;
  author: string;
  role: MemberRole;
  replies: number;
  lastActivity: string;
};

export type BlogPost = {
  id: string;
  title: string;
  author: string;
  readTime: string;
  publishedAt: string;
};