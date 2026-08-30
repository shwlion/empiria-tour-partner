import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Badge, Button, EmptyState, PageHeader, Table } from '@/components/ui';
import { formatDepartureDate, formatPrice } from '@/lib/money';
import { requirePartner } from '@/lib/auth';
import { BOOKING_STATUSES, listBookings, listPackagesForFilter } from '@/lib/console/bookings';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Bookings · Empiria Tour Partner' };

/**
 * Every booking taken on this partner's own tours.
 *
 * The partner did not sell these — Empiria did, as merchant of record — so the
 * screen is a record rather than a workspace: nothing here can be edited, and
 * the two columns that matter most are the departure date and whether the
 * money has arrived. The departure links straight to its manifest, because the
 * question "who booked?" is almost always really "who is coming on the 14th?".
 *
 * Filters are plain GET parameters so a filtered view survives a bookmark.
 */
export default async function PartnerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tour?: string; q?: string }>;
}) {
  const user = await requirePartner();
  const params = await searchParams;

  const [bookings, packages] = await Promise.all([
    listBookings(user.id, { status: params.status, packageId: params.tour, q: params.q }),
    listPackagesForFilter(user.id),
  ]);

  const filtered = Boolean(params.status || params.tour || params.q);
  const paidCount = bookings.filter((b) => b.status === 'paid_in_full').length;
  const pendingCount = bookings.filter((b) => b.status === 'pending_payment').length;
  const travellers = bookings
    .filter((b) => b.status !== 'cancelled' && b.status !== 'refunded')
    .reduce((n, b) => n + b.adults + b.children + b.infants, 0);

  return (
    <>
      <PageHeader
        title="Bookings"
        description={
          bookings.length === 0
            ? filtered
              ? 'Nothing matches these filters.'
              : 'No bookings yet on your tours. They appear here the moment one is taken.'
            : `${bookings.length}${filtered ? ' matching' : ''} · ${travellers} travellers · ${paidCount} paid in full · ${pendingCount} awaiting payment.`
        }
      />

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-xs">
          <label htmlFor="q" className="mb-1.5 block text-[13px] font-medium text-foreground">
            Search
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={params.q ?? ''}
            placeholder="Reference, name or email"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="status" className="mb-1.5 block text-[13px] font-medium text-foreground">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={params.status ?? ''}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
          >
            <option value="">Any status</option>
            {BOOKING_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tour" className="mb-1.5 block text-[13px] font-medium text-foreground">
            Tour
          </label>
          <select
            id="tour"
            name="tour"
            defaultValue={params.tour ?? ''}
            className="max-w-[220px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
          >
            <option value="">All my tours</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          <Search size={14} aria-hidden="true" />
          Filter
        </Button>
        {filtered && (
          <Link
            href="/dashboard/bookings"
            className="py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </Link>
        )}
      </form>

      {bookings.length === 0 ? (
        <EmptyState
          title={filtered ? 'No matching bookings' : 'No bookings yet'}
          description={
            filtered
              ? 'Try clearing a filter, or search by part of the reference.'
              : 'Publish a tour with departures on sale and bookings will appear here as they are taken.'
          }
        />
      ) : (
        <Table
          head={['Reference', 'Lead traveller', 'Tour', 'Departs', 'Party', 'Paid', 'Total', 'Status']}
        >
          {bookings.map((b) => {
            const party =
              `${b.adults}A` +
              (b.children > 0 ? ` ${b.children}C` : '') +
              (b.infants > 0 ? ` ${b.infants}i` : '');
            return (
              <tr key={b.id} className="transition-colors hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/bookings/${b.id}`}
                    className="font-mono text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {b.reference}
                  </Link>
                  <div className="text-[12px] text-muted-foreground">
                    booked {formatDepartureDate(b.createdAt)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-foreground">{b.leadName}</div>
                  <div className="max-w-[200px] truncate text-[12px] text-muted-foreground">
                    {b.leadEmail}
                  </div>
                </td>
                <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                  {b.packageTitle}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/departures/${b.departureId}`}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    {formatDepartureDate(b.departureStartsOn)}
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{party}</td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {b.amountPaidCents > 0 ? formatPrice(b.amountPaidCents, b.currency) : '—'}
                </td>
                <td className="px-4 py-3 tabular-nums text-foreground">
                  {formatPrice(b.totalCents, b.currency)}
                </td>
                <td className="px-4 py-3">
                  <Badge value={b.status} />
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
