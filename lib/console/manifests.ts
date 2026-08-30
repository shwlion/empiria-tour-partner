import { getSupabaseAdmin } from '@/lib/supabase';
import {
  TRAVELLING_STATUSES,
  type EmergencyContact,
  type TravellerRow,
} from './bookings';
import type { Manifest, ManifestBooking, ManifestExtra } from './manifest-csv';

// The serialiser and the types it needs live in `manifest-csv.ts`, which has no
// database import and so can be tested directly. Re-exported here so callers
// have one place to import a manifest from.
export * from './manifest-csv';

/**
 * The departure manifest — the reason this dashboard exists.
 *
 * Everything else here is preparation; this is the screen somebody opens the
 * morning of a departure to find out who is actually coming, what they cannot
 * eat, who to telephone when a flight is late, and which rooms to hold. One
 * departure, everyone travelling on it, in the order they booked.
 *
 * Only committed bookings appear. A `pending_payment` booking is a seat hold
 * with a timer on it, not a passenger, and a manifest that counted holds would
 * send a coach with empty seats.
 *
 * Scoped like `bookings.ts`: the partner id is the first argument, applied
 * unconditionally, and re-checked against the departure's package after the
 * read. A manifest is the richest personal data in the product — dates of
 * birth, dietary and accessibility notes, next of kin — so the one place it
 * must not be possible to fetch by guessing a uuid is here.
 *
 * `notes_internal` is deliberately not carried over from the admin manifest.
 * Those are Empiria's notes to itself about a customer.
 */

export async function getManifest(
  partnerId: string,
  departureId: string
): Promise<Manifest | null> {
  if (!partnerId) throw new Error('A partner scope is required to read a manifest.');
  const db = getSupabaseAdmin();
  if (!db) return null;

  const { data: d } = await db
    .from('departures')
    .select(
      'id, starts_on, ends_on, start_time, status, capacity, seats_booked, seats_held, ' +
        'packages!inner ( id, title, slug, currency, partner_id )'
    )
    .eq('id', departureId)
    .eq('packages.partner_id', partnerId)
    .maybeSingle();
  if (!d) return null;

  type DepartureJoined = {
    id: string; starts_on: string; ends_on: string | null; start_time: string | null;
    status: string; capacity: number; seats_booked: number; seats_held: number;
    packages: { id: string; title: string; slug: string; currency: string; partner_id: string | null };
  };
  const departure = d as unknown as DepartureJoined;
  if (departure.packages.partner_id !== partnerId) return null;

  const { data: bookingRows } = await db
    .from('bookings')
    .select(
      'id, reference, status, lead_name, lead_email, lead_phone, adults, children, infants, ' +
        'single_supplement, room_types ( name )'
    )
    .eq('departure_id', departureId)
    .in('status', [...TRAVELLING_STATUSES])
    .order('created_at');

  type BookingJoined = {
    id: string; reference: string; status: string; lead_name: string; lead_email: string;
    lead_phone: string | null; adults: number; children: number; infants: number;
    single_supplement: boolean;
    room_types: { name: string } | null;
  };
  const bookings = (bookingRows ?? []) as unknown as BookingJoined[];
  const bookingIds = bookings.map((b) => b.id);

  const [fieldRows, travellerRows, extraRows, responseRows] = await Promise.all([
    db
      .from('package_custom_fields')
      .select('id, label, applies_to, sort_order')
      .eq('package_id', departure.packages.id)
      .order('sort_order'),
    bookingIds.length
      ? db.from('travellers').select('*').in('booking_id', bookingIds).order('position')
      : Promise.resolve({ data: [] as never[] }),
    bookingIds.length
      ? db
          .from('booking_price_lines')
          .select('booking_id, label, quantity')
          .eq('kind', 'extra')
          .in('booking_id', bookingIds)
      : Promise.resolve({ data: [] as never[] }),
    bookingIds.length
      ? db
          .from('custom_field_responses')
          .select('booking_id, traveller_id, field_id, value')
          .in('booking_id', bookingIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const travellersByBooking = new Map<string, TravellerRow[]>();
  for (const t of (travellerRows.data ?? []) as {
    id: string; booking_id: string; position: number; traveller_type: string;
    legal_name: string; date_of_birth: string | null; is_lead: boolean;
    dietary_notes: string | null; accessibility_notes: string | null;
    emergency_contact: unknown;
  }[]) {
    const list = travellersByBooking.get(t.booking_id) ?? [];
    list.push({
      id: t.id,
      position: t.position,
      travellerType: t.traveller_type,
      legalName: t.legal_name,
      dateOfBirth: t.date_of_birth,
      isLead: t.is_lead,
      dietaryNotes: t.dietary_notes,
      accessibilityNotes: t.accessibility_notes,
      emergencyContact: (t.emergency_contact ?? null) as EmergencyContact,
    });
    travellersByBooking.set(t.booking_id, list);
  }

  const extrasByBooking = new Map<string, ManifestExtra[]>();
  for (const e of (extraRows.data ?? []) as { booking_id: string; label: string; quantity: number }[]) {
    const list = extrasByBooking.get(e.booking_id) ?? [];
    list.push({ label: e.label, quantity: e.quantity });
    extrasByBooking.set(e.booking_id, list);
  }

  const bookingResponses = new Map<string, Record<string, string>>();
  const travellerResponses = new Map<string, Record<string, string>>();
  for (const r of (responseRows.data ?? []) as {
    booking_id: string; traveller_id: string | null; field_id: string; value: string | null;
  }[]) {
    if (r.value == null || r.value === '') continue;
    if (r.traveller_id) {
      const bag = travellerResponses.get(r.traveller_id) ?? {};
      bag[r.field_id] = r.value;
      travellerResponses.set(r.traveller_id, bag);
    } else {
      const bag = bookingResponses.get(r.booking_id) ?? {};
      bag[r.field_id] = r.value;
      bookingResponses.set(r.booking_id, bag);
    }
  }

  const manifestBookings: ManifestBooking[] = bookings.map((b) => ({
    id: b.id,
    reference: b.reference,
    status: b.status,
    leadName: b.lead_name,
    leadEmail: b.lead_email,
    leadPhone: b.lead_phone,
    adults: b.adults,
    children: b.children,
    infants: b.infants,
    roomTypeName: b.room_types?.name ?? null,
    singleSupplement: b.single_supplement,
    extras: extrasByBooking.get(b.id) ?? [],
    travellers: travellersByBooking.get(b.id) ?? [],
    bookingResponses: bookingResponses.get(b.id) ?? {},
    travellerResponses: Object.fromEntries(
      (travellersByBooking.get(b.id) ?? []).map((t) => [t.id, travellerResponses.get(t.id) ?? {}])
    ),
  }));

  return {
    departureId: departure.id,
    startsOn: departure.starts_on,
    endsOn: departure.ends_on,
    startTime: departure.start_time,
    status: departure.status,
    capacity: departure.capacity,
    seatsBooked: departure.seats_booked,
    seatsHeld: departure.seats_held,
    packageId: departure.packages.id,
    packageTitle: departure.packages.title,
    packageSlug: departure.packages.slug,
    currency: departure.packages.currency,
    fields: (fieldRows.data ?? []).map((f) => ({ id: f.id, label: f.label, appliesTo: f.applies_to })),
    bookings: manifestBookings,
    travellerCount: manifestBookings.reduce((n, b) => n + b.travellers.length, 0),
  };
}

