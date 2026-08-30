import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * Bookings for one partner's own tours — the partner mirror of Exhibit A B3.
 *
 * Two things make this a separate module rather than an import of the admin
 * one, and both are deliberate.
 *
 * **The scope is a required argument, not a filter.** In the admin console
 * `partnerId` is optional, because staff legitimately see everything. Here an
 * omitted scope would show one partner another partner's bookings, so it is
 * the first parameter of every function and the query applies it
 * unconditionally. A caller cannot forget it: TypeScript refuses, and the
 * runtime guard refuses an empty string, which is the shape a forgotten
 * `user.id` actually takes.
 *
 * **The types are narrower, not filtered.** A partner sees less of a booking
 * than staff do, and the safe way to express that is a type with no field for
 * the things they must not see — not the staff type rendered carefully. A
 * missing field cannot leak; a field you forgot to leave out of the JSX can.
 * What is deliberately absent:
 *
 *  - `notes_internal`. Empiria's staff write these about the customer, on the
 *    reasonable assumption that only Empiria reads them. Refund arguments and
 *    complaint history are not a partner's business, and staff have no way to
 *    know a partner is reading over their shoulder.
 *  - The payments ledger. Empiria is merchant of record (§2.2); Stripe
 *    references and processor fees are its financial record, not the
 *    partner's. What a partner actually needs — is this booking paid, and by
 *    when is the balance due — is on the booking itself.
 *  - The Part D acknowledgement snapshots. Those exist to prove what Empiria
 *    disclosed to a traveller. They are a compliance record, and duplicating
 *    them here would only spread it.
 *
 * Contact details are present, because a partner meets these people at an
 * airport. `manageCustomers: false` means no searchable directory of everyone
 * who ever booked — the thing that becomes a marketing list — not that the
 * operator running Tuesday's departure may not phone a delayed traveller.
 */

/** Statuses that mean somebody is actually travelling. */
export const TRAVELLING_STATUSES = ['confirmed', 'balance_due', 'paid_in_full', 'travelled'] as const;

export const BOOKING_STATUSES = [
  'pending_payment', 'confirmed', 'balance_due', 'paid_in_full',
  'travelled', 'cancelled', 'refunded',
] as const;

export type EmergencyContact = { name?: string; phone?: string; relationship?: string } | null;

/** The scope every read here is anchored to. Empty means a bug, not "all". */
function requireScope(partnerId: string): string {
  if (!partnerId) {
    throw new Error('A partner scope is required to read bookings.');
  }
  return partnerId;
}

export type BookingListRow = {
  id: string;
  reference: string;
  status: string;
  leadName: string;
  leadEmail: string;
  adults: number;
  children: number;
  infants: number;
  totalCents: number;
  amountPaidCents: number;
  currency: string;
  createdAt: string;
  balanceDueOn: string | null;
  packageId: string;
  packageTitle: string;
  departureId: string;
  departureStartsOn: string;
};

export type BookingListFilters = {
  status?: string;
  packageId?: string;
  /** Matches reference, lead name or lead email. */
  q?: string;
  limit?: number;
};

type ListJoined = {
  id: string; reference: string; status: string; lead_name: string; lead_email: string;
  adults: number; children: number; infants: number; total_cents: number;
  amount_paid_cents: number; currency: string; created_at: string; balance_due_on: string | null;
  departure_id: string;
  packages: { id: string; title: string };
  departures: { starts_on: string };
};

export async function listBookings(
  partnerId: string,
  filters: BookingListFilters = {}
): Promise<BookingListRow[]> {
  const scope = requireScope(partnerId);
  const db = getSupabaseAdmin();
  if (!db) return [];

  let q = db
    .from('bookings')
    .select(
      'id, reference, status, lead_name, lead_email, adults, children, infants, ' +
        'total_cents, amount_paid_cents, currency, created_at, balance_due_on, departure_id, ' +
        'packages!inner ( id, title, partner_id ), departures!inner ( starts_on )'
    )
    .eq('packages.partner_id', scope)
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.status && (BOOKING_STATUSES as readonly string[]).includes(filters.status)) {
    q = q.eq('status', filters.status);
  }
  if (filters.packageId) q = q.eq('package_id', filters.packageId);
  if (filters.q) {
    // Escape PostgREST's or() syntax characters rather than trying to support them.
    const needle = filters.q.replace(/[,()%]/g, ' ').trim();
    if (needle) {
      q = q.or(
        `reference.ilike.%${needle}%,lead_name.ilike.%${needle}%,lead_email.ilike.%${needle}%`
      );
    }
  }

  const { data } = await q;
  return ((data ?? []) as unknown as ListJoined[]).map((b) => ({
    id: b.id,
    reference: b.reference,
    status: b.status,
    leadName: b.lead_name,
    leadEmail: b.lead_email,
    adults: b.adults,
    children: b.children,
    infants: b.infants,
    totalCents: b.total_cents,
    amountPaidCents: b.amount_paid_cents,
    currency: b.currency,
    createdAt: b.created_at,
    balanceDueOn: b.balance_due_on,
    packageId: b.packages.id,
    packageTitle: b.packages.title,
    departureId: b.departure_id,
    departureStartsOn: b.departures.starts_on,
  }));
}

/** id/title pairs for the list page's tour filter — the partner's own tours only. */
export async function listPackagesForFilter(
  partnerId: string
): Promise<{ id: string; title: string }[]> {
  const scope = requireScope(partnerId);
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data } = await db
    .from('packages')
    .select('id, title')
    .eq('partner_id', scope)
    .order('title');
  return data ?? [];
}

export type TravellerRow = {
  id: string;
  position: number;
  travellerType: string;
  legalName: string;
  dateOfBirth: string | null;
  isLead: boolean;
  dietaryNotes: string | null;
  accessibilityNotes: string | null;
  emergencyContact: EmergencyContact;
};

export type PriceLineRow = {
  id: string;
  kind: string;
  label: string;
  quantity: number;
  unitCents: number;
  amountCents: number;
};

export type FieldResponseRow = {
  id: string;
  travellerId: string | null;
  label: string;
  value: string | null;
};

/**
 * One booking, as much of it as a partner may see.
 *
 * Compare `lib/admin/bookings.ts` in the console repo: no `notesInternal`, no
 * `payments`, no `acknowledgements`, no `userId`. Those omissions are the
 * point of the type.
 */
export type BookingDetail = {
  id: string;
  reference: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string | null;
  adults: number;
  children: number;
  infants: number;
  singleSupplement: boolean;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  feesCents: number;
  totalCents: number;
  amountPaidCents: number;
  depositDueCents: number;
  balanceDueOn: string | null;
  /** §4.6. Recorded by Empiria, read-only here. `null` means not yet agreed. */
  supplierCostCents: number | null;
  cancelledAt: string | null;
  packageId: string;
  packageTitle: string;
  departureId: string;
  departureStartsOn: string;
  departureEndsOn: string | null;
  roomTypeName: string | null;
  promotionCode: string | null;
  travellers: TravellerRow[];
  priceLines: PriceLineRow[];
  fieldResponses: FieldResponseRow[];
};

type DetailJoined = {
  id: string; reference: string; status: string; created_at: string; updated_at: string;
  lead_name: string; lead_email: string; lead_phone: string | null;
  adults: number; children: number; infants: number; single_supplement: boolean;
  currency: string; subtotal_cents: number; discount_cents: number; tax_cents: number;
  fees_cents: number; total_cents: number; amount_paid_cents: number;
  deposit_due_cents: number; balance_due_on: string | null;
  supplier_cost_cents: number | null; cancelled_at: string | null;
  departure_id: string;
  packages: { id: string; title: string; partner_id: string | null };
  departures: { starts_on: string; ends_on: string | null };
  room_types: { name: string } | null;
  promotions: { code: string } | null;
};

export async function getBookingDetail(
  partnerId: string,
  id: string
): Promise<BookingDetail | null> {
  const scope = requireScope(partnerId);
  const db = getSupabaseAdmin();
  if (!db) return null;

  // Columns are listed rather than selected with `*`, so a future migration
  // that adds a staff-only column does not silently start returning it here.
  const { data: b } = await db
    .from('bookings')
    .select(
      'id, reference, status, created_at, updated_at, lead_name, lead_email, lead_phone, ' +
        'adults, children, infants, single_supplement, currency, subtotal_cents, ' +
        'discount_cents, tax_cents, fees_cents, total_cents, amount_paid_cents, ' +
        'deposit_due_cents, balance_due_on, supplier_cost_cents, cancelled_at, departure_id, ' +
        'packages!inner ( id, title, partner_id ), departures!inner ( starts_on, ends_on ), ' +
        'room_types ( name ), promotions ( code )'
    )
    .eq('id', id)
    .eq('packages.partner_id', scope)
    .maybeSingle();
  if (!b) return null;

  const booking = b as unknown as DetailJoined;
  // Belt and braces. The query above already filters on the join, but this is
  // exactly the page where a broken filter would hand over somebody else's
  // customer, so the check is repeated where it is impossible to miss.
  if (booking.packages.partner_id !== scope) return null;

  const [travellers, lines, responses] = await Promise.all([
    db.from('travellers').select('*').eq('booking_id', id).order('position'),
    db.from('booking_price_lines').select('*').eq('booking_id', id).order('sort_order'),
    db
      .from('custom_field_responses')
      .select('id, traveller_id, value, package_custom_fields!inner ( label, sort_order )')
      .eq('booking_id', id),
  ]);

  type ResponseJoined = {
    id: string; traveller_id: string | null; value: string | null;
    package_custom_fields: { label: string; sort_order: number };
  };
  const fieldResponses = ((responses.data ?? []) as unknown as ResponseJoined[])
    .sort((a, z) => a.package_custom_fields.sort_order - z.package_custom_fields.sort_order)
    .map((r) => ({
      id: r.id,
      travellerId: r.traveller_id,
      label: r.package_custom_fields.label,
      value: r.value,
    }));

  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    createdAt: booking.created_at,
    updatedAt: booking.updated_at,
    leadName: booking.lead_name,
    leadEmail: booking.lead_email,
    leadPhone: booking.lead_phone,
    adults: booking.adults,
    children: booking.children,
    infants: booking.infants,
    singleSupplement: booking.single_supplement,
    currency: booking.currency,
    subtotalCents: booking.subtotal_cents,
    discountCents: booking.discount_cents,
    taxCents: booking.tax_cents,
    feesCents: booking.fees_cents,
    totalCents: booking.total_cents,
    amountPaidCents: booking.amount_paid_cents,
    depositDueCents: booking.deposit_due_cents,
    balanceDueOn: booking.balance_due_on,
    supplierCostCents: booking.supplier_cost_cents,
    cancelledAt: booking.cancelled_at,
    packageId: booking.packages.id,
    packageTitle: booking.packages.title,
    departureId: booking.departure_id,
    departureStartsOn: booking.departures.starts_on,
    departureEndsOn: booking.departures.ends_on,
    roomTypeName: booking.room_types?.name ?? null,
    promotionCode: booking.promotions?.code ?? null,
    travellers: (travellers.data ?? []).map((t) => ({
      id: t.id,
      position: t.position,
      travellerType: t.traveller_type,
      legalName: t.legal_name,
      dateOfBirth: t.date_of_birth,
      isLead: t.is_lead,
      dietaryNotes: t.dietary_notes,
      accessibilityNotes: t.accessibility_notes,
      emergencyContact: (t.emergency_contact ?? null) as EmergencyContact,
    })),
    priceLines: (lines.data ?? []).map((l) => ({
      id: l.id,
      kind: l.kind,
      label: l.label,
      quantity: l.quantity,
      unitCents: l.unit_cents,
      amountCents: l.amount_cents,
    })),
    fieldResponses,
  };
}

/** The balance still owed, floored at zero — an overpayment is not a negative debt. */
export function balanceCents(b: { totalCents: number; amountPaidCents: number }): number {
  return Math.max(0, b.totalCents - b.amountPaidCents);
}
