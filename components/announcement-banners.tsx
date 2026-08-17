import { AnnouncementBody } from "@/components/announcement-body";
import { Button } from "@/components/ui/button";
import type { MemberBanner } from "@/lib/announcements/list";

export function AnnouncementBanners({ banners }: { banners: MemberBanner[] }) {
  if (banners.length === 0) {
    return null;
  }
  return (
    <section aria-label="Announcements" className="flex flex-col gap-3 p-6">
      {banners.map((banner) => (
        <article
          className="rounded-md border border-border bg-background p-4"
          key={banner.id}
        >
          <h2 className="text-lg font-medium text-foreground">{banner.headline}</h2>
          <AnnouncementBody source={banner.body} />
          <div className="mt-3 flex flex-wrap gap-3">
            {banner.ctaPrimaryLabel ? (
              <form action={`/app/announcements/${banner.id}/cta/primary`} method="post">
                <Button type="submit">{banner.ctaPrimaryLabel}</Button>
              </form>
            ) : null}
            {banner.ctaSecondaryLabel ? (
              <form action={`/app/announcements/${banner.id}/cta/secondary`} method="post">
                <Button type="submit" variant="secondary">
                  {banner.ctaSecondaryLabel}
                </Button>
              </form>
            ) : null}
            {banner.dismissible ? (
              <form action={`/app/announcements/${banner.id}/dismiss`} method="post">
                <Button type="submit" variant="ghost">
                  Dismiss
                </Button>
              </form>
            ) : null}
          </div>
        </article>
      ))}
    </section>
  );
}
