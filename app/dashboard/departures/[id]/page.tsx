import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download } from 'lucide-react';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui';
import { formatDateRange, formatDepartureDate } from '@/lib/money';
import { requirePartner } from '@/lib/auth';
import { formatEmergencyContact, getManifest } from '@/lib/console/manifests';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Manifest · Empiria Tour Partner' };

/**
 * Who is actually coming.
 *
 * This is the screen a partner prints or exports the week before a departure,
 * so it is laid out for reading on paper rather than for clicking: one block
 * per booking, travellers listed under it, and everything the ground team needs
 * beside the name rather than behind a link.
 *
 * Only committed bookings are here. Seats being held while somebody types their
 * card number are counted in the header — so the numbers reconcile with the
 * departures list — but nobody appears on the manifest until their money has
 * arrived.
 */
export default async function PartnerManifestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePartner();
  const { id } = await params;
  const manifest = await getManifest(user.id, id);
  if (!manifest) notFound();

  const { bookings, fields } = manifest;
  const bookingFields = fields.filter((f) => f.appliesTo !== 'traveller');
  const travellerFields = fields.filter((f) => f.appliesTo === 'traveller');
  const seatsLeft = Math.max(0, manifest.capacity - manifest.seatsBooked - manifest.seatsHeld);

  return (
    <>
      <Link
        href="/dashboard/departures"
        className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        All departures
      </Link>

      <PageHeader
        title={formatDateRange(manifest.startsOn, manifest.endsOn)}
        description={`${manifest.packageTitle}${manifest.startTime ? ` · departs ${manifest.startTime.slice(0, 5)}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge value={manifest.status} />
            {manifest.travellerCount > 0 && (
              <a
                href={`/dashboard/departures/${manifest.departureId}/csv`}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Download size={14} aria-hidden="true" />
                Export CSV
              </a>
            )}
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Travelling" value={manifest.travellerCount} />
        <Stat label="Bookings" value={bookings.length} />
        <Stat
          label="Seats held"
          value={manifest.seatsHeld}
          hint={manifest.seatsHeld > 0 ? 'being paid for' : undefined}
        />
        <Stat label="Seats left" value={seatsLeft} hint={`of ${manifest.capacity}`} />
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          title="Nobody is booked on this departure yet"
          description={
            manifest.seatsHeld > 0
              ? `${manifest.seatsHeld} ${manifest.seatsHeld === 1 ? 'seat is' : 'seats are'} being held while someone pays. They appear here once payment arrives.`
              : 'Travellers appear here as soon as their payment goes through.'
          }
        />
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => {
            const party =
              `${b.adults} adult${b.adults === 1 ? '' : 's'}` +
              (b.children > 0 ? `, ${b.children} child${b.children === 1 ? '' : 'ren'}` : '') +
              (b.infants > 0 ? `, ${b.infants} infant${b.infants === 1 ? '' : 's'}` : '');

            return (
              <Card key={b.id}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <Link
                      href={`/dashboard/bookings/${b.id}`}
                      className="font-mono text-[14px] font-semibold text-foreground transition-colors hover:text-primary"
                    >
                      {b.reference}
                    </Link>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {b.leadName} · {party}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      <a href={`mailto:${b.leadEmail}`} className="hover:text-primary">
                        {b.leadEmail}
                      </a>
                      {b.leadPhone && (
                        <>
                          {' · '}
                          <a href={`tel:${b.leadPhone}`} className="hover:text-primary">
                            {b.leadPhone}
                          </a>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge value={b.status} />
                    {b.roomTypeName && (
                      <span className="text-[12px] text-muted-foreground">
                        {b.roomTypeName}
                        {b.singleSupplement ? ' · single' : ''}
                      </span>
                    )}
                  </div>
                </div>

                {b.extras.length > 0 && (
                  <p className="mb-3 text-[13px] text-muted-foreground">
                    <span className="font-medium text-foreground">Extras: </span>
                    {b.extras
                      .map((e) => (e.quantity > 1 ? `${e.label} ×${e.quantity}` : e.label))
                      .join(' · ')}
                  </p>
                )}

                {bookingFields.length > 0 && (
                  <dl className="mb-3 space-y-1 text-[13px]">
                    {bookingFields.map((f) =>
                      b.bookingResponses[f.id] ? (
                        <div key={f.id} className="flex gap-3">
                          <dt className="w-48 shrink-0 text-muted-foreground">{f.label}</dt>
                          <dd className="text-foreground">{b.bookingResponses[f.id]}</dd>
                        </div>
                      ) : null
                    )}
                  </dl>
                )}

                <ul className="divide-y divide-border">
                  {b.travellers.map((t) => {
                    const answers = travellerFields
                      .map((f) => ({ label: f.label, value: b.travellerResponses[t.id]?.[f.id] }))
                      .filter((a) => a.value);
                    return (
                      <li key={t.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-medium text-foreground">{t.legalName}</span>
                          <span className="text-[12px] capitalize text-muted-foreground">
                            {t.travellerType}
                          </span>
                          {t.dateOfBirth && (
                            <span className="text-[12px] text-muted-foreground">
                              b. {formatDepartureDate(t.dateOfBirth)}
                            </span>
                          )}
                          {t.isLead && (
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              lead
                            </span>
                          )}
                        </div>
                        {(t.dietaryNotes || t.accessibilityNotes || t.emergencyContact) && (
                          <div className="mt-1 space-y-0.5 text-[12px]">
                            {t.dietaryNotes && (
                              <p className="text-muted-foreground">
                                <span className="font-medium">Dietary: </span>
                                {t.dietaryNotes}
                              </p>
                            )}
                            {t.accessibilityNotes && (
                              <p className="text-amber-700">
                                <span className="font-medium">Accessibility: </span>
                                {t.accessibilityNotes}
                              </p>
                            )}
                            {formatEmergencyContact(t.emergencyContact) && (
                              <p className="text-muted-foreground">
                                <span className="font-medium">In an emergency: </span>
                                {formatEmergencyContact(t.emergencyContact)}
                              </p>
                            )}
                          </div>
                        )}
                        {answers.length > 0 && (
                          <dl className="mt-1 space-y-0.5 text-[12px]">
                            {answers.map((a) => (
                              <div key={a.label} className="flex gap-3">
                                <dt className="w-44 shrink-0 text-muted-foreground">{a.label}</dt>
                                <dd className="text-foreground">{a.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-bold tabular-nums text-foreground">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
