export type AnalyticsEventRecord = {
  id: string;
  occurredAt: Date;
};

export type AnalyticsRetentionPort = {
  deleteOlderThan(cutoff: Date): Promise<number>;
};

/** Production default: no PostHog delete client. Honest 0, no fake trail count. */
export const defaultAnalyticsRetentionPort: AnalyticsRetentionPort = {
  async deleteOlderThan(): Promise<number> {
    return 0;
  },
};

export function createInMemoryAnalyticsRetentionPort(
  seed: AnalyticsEventRecord[] = [],
): AnalyticsRetentionPort & { snapshot: () => AnalyticsEventRecord[] } {
  const events = [...seed];
  return {
    async deleteOlderThan(cutoff: Date): Promise<number> {
      let deleted = 0;
      for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event && event.occurredAt < cutoff) {
          events.splice(index, 1);
          deleted += 1;
        }
      }
      return deleted;
    },
    snapshot(): AnalyticsEventRecord[] {
      return [...events];
    },
  };
}
