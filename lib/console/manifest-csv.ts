import type { EmergencyContact, TravellerRow } from './bookings';

/**
 * Turning a manifest into a file.
 *
 * Separate from `manifests.ts` because none of this touches a database, and a
 * module that imports a database client cannot be tested without pretending to
 * be one. The type import above is erased at compile time, so nothing here
 * loads at runtime but the functions themselves.
 */

export type ManifestExtra = { label: string; quantity: number };

export type ManifestBooking = {
  id: string;
  reference: string;
  status: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string | null;
  adults: number;
  children: number;
  infants: number;
  roomTypeName: string | null;
  singleSupplement: boolean;
  extras: ManifestExtra[];
  travellers: TravellerRow[];
  /** field id → value, for booking-level custom fields. */
  bookingResponses: Record<string, string>;
  /** traveller id → (field id → value), for per-traveller fields. */
  travellerResponses: Record<string, Record<string, string>>;
};

export type ManifestField = { id: string; label: string; appliesTo: string };

export type Manifest = {
  departureId: string;
  startsOn: string;
  endsOn: string | null;
  startTime: string | null;
  status: string;
  capacity: number;
  seatsBooked: number;
  seatsHeld: number;
  packageId: string;
  packageTitle: string;
  packageSlug: string;
  currency: string;
  fields: ManifestField[];
  bookings: ManifestBooking[];
  travellerCount: number;
};

/**
 * A UTF-8 byte-order mark.
 *
 * Excel on Windows assumes the system code page for a .csv unless the file
 * opens with this, which turns every non-ASCII name in the manifest into
 * mojibake — and a passenger list is exactly where names like Nguyễn, José and
 * 김민준 appear. Three bytes to stop a support ticket. It is prepended at the
 * response, not inside `manifestToCsv`, so the function still returns CSV and
 * not CSV-plus-a-surprise.
 */
export const CSV_BOM = '\uFEFF';

export function formatEmergencyContact(c: EmergencyContact): string {
  if (!c) return '';
  const parts = [c.name, c.phone, c.relationship].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== ''
  );
  return parts.join(' · ');
}

/** RFC 4180 quoting: doubled quotes, wrapped when a comma, quote or newline appears. */
function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The manifest flattened to one row per traveller, booking columns repeated —
 * the shape a ground operator drops straight into their own spreadsheet.
 * Custom fields become trailing columns, per-booking answers repeated on each
 * of that booking's rows.
 */
export function manifestToCsv(manifest: Manifest): string {
  const head = [
    'Booking', 'Booking status', 'Lead contact', 'Lead email', 'Lead phone', 'Room', 'Extras',
    'Traveller', 'Type', 'Legal name', 'Date of birth', 'Dietary', 'Accessibility',
    'Emergency contact',
    ...manifest.fields.map((f) => f.label),
  ];
  const rows: string[] = [head.map(csvCell).join(',')];

  for (const b of manifest.bookings) {
    const extras = b.extras
      .map((e) => (e.quantity > 1 ? `${e.label} ×${e.quantity}` : e.label))
      .join('; ');
    for (const t of b.travellers) {
      rows.push(
        [
          b.reference,
          b.status,
          b.leadName,
          b.leadEmail,
          b.leadPhone ?? '',
          b.roomTypeName ?? '',
          extras,
          t.position,
          t.travellerType,
          t.legalName,
          t.dateOfBirth ?? '',
          t.dietaryNotes ?? '',
          t.accessibilityNotes ?? '',
          formatEmergencyContact(t.emergencyContact),
          ...manifest.fields.map((f) =>
            f.appliesTo === 'traveller'
              ? (b.travellerResponses[t.id]?.[f.id] ?? '')
              : (b.bookingResponses[f.id] ?? '')
          ),
        ]
          .map(csvCell)
          .join(',')
      );
    }
  }
  return rows.join('\r\n') + '\r\n';
}

/** A filename a partner can find again after they have downloaded six of them. */
export function manifestFilename(manifest: Manifest): string {
  const slug = manifest.packageSlug || 'departure';
  return `manifest-${slug}-${manifest.startsOn.slice(0, 10)}.csv`;
}
