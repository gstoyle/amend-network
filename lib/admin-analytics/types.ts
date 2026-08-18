export type AdminAnalyticsKpis = {
  approvedMembers: number;
  mam: number;
  mamPathways: number;
  mamLead: number;
  pendingRegistrations: number;
  liveResources: number;
  uncancelledEvents: number;
  currentAnnouncements: number;
};

export type AdminAnalyticsFunnel = {
  invitation: number;
  registration: number;
  approval: number;
  firstLogin: number;
  retentionEligible: number;
  retained: number;
};

export type AdminAnalyticsResourceRank = {
  id: string;
  title: string;
  downloadCount: number;
};

export type AdminAnalyticsEventRank = {
  id: string;
  title: string;
  yesCount: number;
};

export type AdminAnalyticsSnapshot = {
  kpis: AdminAnalyticsKpis;
  funnel: AdminAnalyticsFunnel;
  topResources: AdminAnalyticsResourceRank[];
  topEvents: AdminAnalyticsEventRank[];
};
