import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarRange, MapPinned, PlusCircle, TriangleAlert } from 'lucide-react';
import { Button, Card, PageHeader } from '@/components/ui';
import { formatDepartureDate } from '@/lib/money';
import { requirePartner } from '@/lib/auth';
import { listPackages } from '@/lib/console/packages';
import { listUpcomingDepartures } from '@/lib/console/departures';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Overview · Empiria Tour Partner' };

/**
 * The partner's overview.
 *
 * The scaffold shipped a revenue chart drawing fifty-six lines of invented
 * numbers — a payout figure that was never real, on the one screen where being
 * wrong about money matters most. Payouts need the revenue-share calculation
 * (B5), which needs supplier cost per booking, which Empiria has not started
 * entering. Until then this shows what is true: the state of their catalogue
 * and what is stopping any of it selling.
 */
export default async function OverviewPage() {
  const user = await requirePartner();
  const [packages, departures] = await Promise.all([
    listPackages(user.id),
    listUpcomingDepartures(user.id, 8),
  ]);

  const live = packages.filter((p) => p.status === 'published');
  const drafts = packages.filter((p) => p.status === 'draft');
  const stranded = packages.filter((p) => p.status === 'published' && p.departureCount === 0);
  const seatsSold = packages.reduce((n, p) => n + p.seatsSold, 0);

  return (
    <>
      <PageHeader
        title={`Welcome back${user.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description="Your tours, your dates, and anything standing in the way of a booking."
        actions={
          <Link href="/dashboard/tours/new">
            <Button>
              <PlusCircle size={14} aria-hidden="true" />
              New tour
            </Button>
          </Link>
        }
      />

      {packages.length === 0 ? (
        <Card title="Nothing here yet">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            You have no tours. Create one and it starts as a draft — nothing is public until you
            publish it, and publishing is refused until it has a price, an itinerary and dates.
          </p>
          <Link href="/dashboard/tours/new" className="mt-4 inline-block">
            <Button>
              <PlusCircle size={14} aria-hidden="true" />
              Create your first tour
            </Button>
          </Link>
        </Card>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-4">
            <Stat label="Live" value={live.length} href="/dashboard/tours" icon={MapPinned} />
            <Stat label="In draft" value={drafts.length} href="/dashboard/tours" icon={MapPinned} />
            <Stat label="Upcoming dates" value={departures.length} href="/dashboard/departures" icon={CalendarRange} />
            <Stat label="Seats sold" value={seatsSold} href="/dashboard/tours" icon={CalendarRange} />
          </div>

          {stranded.length > 0 && (
            <Card className="mb-5" title="Live but unbookable">
              <p className="mb-3 text-[13px] leading-relaxed text-muted-foreground">
                These are on the site with no departures, so a traveller can read about them and
                then hit a dead end.
              </p>
              <ul className="flex flex-col gap-1.5">
                {stranded.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 text-[13px]">
                    <TriangleAlert size={14} className="shrink-0 text-destructive" aria-hidden="true" />
                    <Link
                      href={`/dashboard/tours/${p.id}/departures`}
                      className="text-foreground transition-colors hover:text-primary"
                    >
                      {p.title}
                    </Link>
                    <span className="text-muted-foreground">— add dates</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Going out next">
              {departures.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">No dates scheduled yet.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {departures.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-4 py-2.5">
                      <div className="min-w-0">
                        <Link
                          href={`/dashboard/tours/${d.packageId}/departures`}
                          className="block truncate text-[13px] font-medium text-foreground transition-colors hover:text-primary"
                        >
                          {d.packageTitle}
                        </Link>
                        <span className="text-[12px] text-muted-foreground">
                          {formatDepartureDate(d.startsOn)}
                        </span>
                      </div>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
                        {d.seatsBooked}/{d.capacity} sold
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title="Your tours">
              <ul className="flex flex-col divide-y divide-border">
                {packages.slice(0, 8).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-4 py-2.5">
                    <Link
                      href={`/dashboard/tours/${p.id}`}
                      className="min-w-0 truncate text-[13px] font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {p.title}
                    </Link>
                    <span className="shrink-0 text-[12px] capitalize text-muted-foreground">{p.status}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-muted-foreground">
        Payouts and revenue share arrive once Empiria begins recording supplier cost per booking.
        Nothing here estimates them in the meantime.
      </p>
    </>
  );
}

function Stat({
  label,
  value,
  href,
  icon: Icon,
}: {
  label: string;
  value: number;
  href: string;
  icon: typeof MapPinned;
}) {
  return (
    <Link href={href} className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary">
      <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon size={14} aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold tabular-nums text-foreground">{value}</div>
    </Link>
  );
}
