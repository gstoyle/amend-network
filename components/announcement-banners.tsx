import { AnnouncementBody } from "@/components/announcement-body";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { MemberBanner } from "@/lib/announcements/list";
import { formatDayMonthYear } from "@/lib/utils";

export function AnnouncementBanners({ banners }: { banners: MemberBanner[] }) {
  if (banners.length === 0) {
    return null;
  }
  return (
    <section aria-label="Announcements" className="flex flex-col gap-3">
      {banners.map((banner) => (
        <article
          className="relative rounded-lg border border-support bg-support-subtle p-4 lg:p-5"
          key={banner.id}
        >
          <div className="flex gap-3">
            <Icon
              className="mt-0.5 hidden size-5 shrink-0 text-support sm:block"
              name="announce"
            />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-support">Announcement</p>
              <h2 className="mt-1 pr-8 text-lg font-semibold tracking-tight text-foreground lg:text-xl">
                {banner.headline}
              </h2>
              <div className="mt-2 max-w-2xl text-sm">
                <AnnouncementBody source={banner.body} />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {banner.ctaPrimaryLabel ? (
                  <form action={`/app/announcements/${banner.id}/cta/primary`} method="post">
                    <Button
                      className="bg-support text-support-foreground hover:bg-support"
                      type="submit"
                    >
                      {banner.ctaPrimaryLabel}
                    </Button>
                  </form>
                ) : null}
                {banner.ctaSecondaryLabel ? (
                  <form action={`/app/announcements/${banner.id}/cta/secondary`} method="post">
                    <Button type="submit" variant="outline">
                      {banner.ctaSecondaryLabel}
                    </Button>
                  </form>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  Posted {formatDayMonthYear(banner.postedAt)}
                </span>
              </div>
            </div>
          </div>

          {banner.dismissible ? (
            <form
              action={`/app/announcements/${banner.id}/dismiss`}
              className="absolute right-2 top-2"
              method="post"
            >
              <button
                aria-label={`Dismiss announcement: ${banner.headline}`}
                className="flex size-tap items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast ease-standard hover:bg-card hover:text-foreground"
                type="submit"
              >
                <Icon className="size-4" name="close" />
              </button>
            </form>
          ) : null}
        </article>
      ))}
    </section>
  );
}
