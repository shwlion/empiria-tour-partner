import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Users } from 'lucide-react';
import { Badge, Banner, Card, PageHeader, Table } from '@/components/ui';
import { formatDateRange, formatDepartureDate, formatPrice } from '@/lib/money';
import { requirePartner } from '@/lib/auth';
import { balanceCents, getBookingDetail } from '@/lib/console/bookings';
import { formatEmergencyContact } from '@/lib/console/manifests';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Booking · Empiria Tour Partner' };

/**
 * One booking on one of this partner's tours — read-only, on purpose.
 *
 * §2.2 makes Empiria the merchant of record. Every lever that moves money or
 * seats therefore belongs to Empiria's console: amending a party, recording an
 * offline payment, cancelling, refunding. Putting a disabled button here for
 * each of them would only teach a partner to ask why it is greyed out.
 *
 * So this page answers the questions a partner can act on. Who is coming, what
 * they need, what they paid, and — where Empiria has recorded it — what this
 * booking is worth to the partner under §4.6.
 */
export default async function PartnerBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePartner();
  const { id } = await params;
  const booking = await getBookingDetail(user.id, id);
  // A booking on somebody else's tour and a booking that does not exist are
  // the same answer here, deliberately: a distinguishable "not yours" would
  // confirm the reference is real.
  if (!booking) notFound();

  const balance = balanceCents(booking);
  const party = booking.adults + booking.children + booking.infants;
  const cancelled = booking.status === 'cancelled' || booking.status === 'refunded';

  return (
    <>
      <Link
        href="/dashboard/bookings"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All bookings
      </Link>

      <PageHeader
        title={booking.reference}
        description={`${booking.packageTitle} · ${formatDateRange(booking.departureStartsOn, booking.departureEndsOn)}`}
        actions={<Badge value={booking.status} />}
      />

      {cancelled && (
        <Banner tone="error">
          <p className="font-medium">
            This booking was {booking.status === 'refunded' ? 'refunded' : 'cancelled'}
            {booking.cancelledAt ? ` on ${formatDepartureDate(booking.cancelledAt)}` : ''}.
          </p>
          <p className="mt-1">
            These travellers are no longer on the manifest. The record is kept so the seats and
            money can be reconciled.
          </p>
        </Banner>
      )}

      {booking.status === 'pending_payment' && (
        <Banner tone="info">
          <p className="font-medium">This is a seat hold, not yet a booking.</p>
          <p className="mt-1">
            The seats are reserved while the traveller pays. If payment never arrives the hold
            expires and the seats return to sale — nobody on this page is confirmed as travelling
            until then, and they do not appear on the manifest.
          </p>
        </Banner>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card title="Travellers" description={`${party} on this booking.`}>
            <Table head={['#', 'Name', 'Type', 'Date of birth', 'Needs', 'Emergency contact']}>
              {booking.travellers.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{t.position}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-foreground">{t.legalName}</span>
                    {t.isLead && (
                      <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        lead
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{t.travellerType}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.dateOfBirth ? formatDepartureDate(t.dateOfBirth) : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {t.dietaryNotes || t.accessibilityNotes ? (
                      <>
                        {t.dietaryNotes && <div>{t.dietaryNotes}</div>}
                        {t.accessibilityNotes && (
                          <div className="text-amber-700">{t.accessibilityNotes}</div>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatEmergencyContact(t.emergencyContact) || '—'}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>

          <Card
            title="What was charged"
            description="The price lines written when the booking was taken. They are a record of what the traveller agreed to and never change afterwards."
          >
            <Table head={['Item', 'Qty', 'Unit', 'Amount']}>
              {booking.priceLines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3">
                    <span className="text-foreground">{l.label}</span>
                    <span className="ml-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                      {l.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{l.quantity}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {formatPrice(l.unitCents, booking.currency)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    {formatPrice(l.amountCents, booking.currency)}
                  </td>
                </tr>
              ))}
            </Table>
          </Card>

          {booking.fieldResponses.length > 0 && (
            <Card
              title="Answers to your questions"
              description="What these travellers told you through the custom fields on this tour."
            >
              <dl className="divide-y divide-border text-[13px]">
                {booking.fieldResponses.map((r) => (
                  <div key={r.id} className="flex gap-4 py-2.5 first:pt-0 last:pb-0">
                    <dt className="w-56 shrink-0 text-muted-foreground">{r.label}</dt>
                    <dd className="text-foreground">{r.value || '—'}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          <Card title="Lead contact">
            <dl className="space-y-3 text-[13px]">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="mt-0.5 font-medium text-foreground">{booking.leadName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="mt-0.5 break-all text-foreground">
                  <a href={`mailto:${booking.leadEmail}`} className="hover:text-primary">
                    {booking.leadEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="mt-0.5 text-foreground">
                  {booking.leadPhone ? (
                    <a href={`tel:${booking.leadPhone}`} className="hover:text-primary">
                      {booking.leadPhone}
                    </a>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Booked</dt>
                <dd className="mt-0.5 text-foreground">{formatDepartureDate(booking.createdAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card title="Money">
            <dl className="space-y-2 text-[13px]">
              <Row label="Subtotal" value={formatPrice(booking.subtotalCents, booking.currency)} />
              {booking.discountCents > 0 && (
                <Row
                  label={booking.promotionCode ? `Discount (${booking.promotionCode})` : 'Discount'}
                  value={`− ${formatPrice(booking.discountCents, booking.currency)}`}
                />
              )}
              {booking.feesCents > 0 && (
                <Row label="Fees" value={formatPrice(booking.feesCents, booking.currency)} />
              )}
              {booking.taxCents > 0 && (
                <Row label="Tax" value={formatPrice(booking.taxCents, booking.currency)} />
              )}
              <div className="flex justify-between border-t border-border pt-2 font-semibold text-foreground">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatPrice(booking.totalCents, booking.currency)}</dd>
              </div>
              <Row label="Paid" value={formatPrice(booking.amountPaidCents, booking.currency)} />
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Outstanding</dt>
                <dd
                  className={`tabular-nums ${balance > 0 ? 'font-semibold text-amber-700' : 'text-muted-foreground'}`}
                >
                  {formatPrice(balance, booking.currency)}
                </dd>
              </div>
              {balance > 0 && booking.balanceDueOn && (
                <p className="pt-1 text-[12px] text-muted-foreground">
                  Balance due {formatDepartureDate(booking.balanceDueOn)}. Empiria collects it.
                </p>
              )}
            </dl>
          </Card>

          <Card title="Your cost" description="§4.6 of the development agreement.">
            {booking.supplierCostCents == null ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                Empiria has not recorded a supplier cost for this booking yet. Until it does, this
                booking cannot be settled — ask Empiria to enter it.
              </p>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums text-foreground">
                  {formatPrice(booking.supplierCostCents, booking.currency)}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                  Recorded by Empiria against this booking. Shown here so you can check it; it is
                  edited in Empiria&rsquo;s console, not this one.
                </p>
              </>
            )}
          </Card>

          <Card title="Departure">
            <p className="text-[13px] text-foreground">
              {formatDateRange(booking.departureStartsOn, booking.departureEndsOn)}
            </p>
            {booking.roomTypeName && (
              <p className="mt-1 text-[13px] text-muted-foreground">
                {booking.roomTypeName}
                {booking.singleSupplement ? ' · single supplement' : ''}
              </p>
            )}
            <Link
              href={`/dashboard/departures/${booking.departureId}`}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
            >
              <Users size={14} aria-hidden="true" />
              Everyone on this departure
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
