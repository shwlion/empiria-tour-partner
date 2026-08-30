import {
  CSV_BOM,
  formatEmergencyContact,
  manifestFilename,
  manifestToCsv,
  type Manifest,
} from './manifest-csv.ts';

/**
 * The manifest is the one file that leaves this application, and every mistake
 * it can make is silent: a comma that splits a name into two columns, a
 * newline that turns one traveller into two rows, a quote that swallows the
 * rest of the file. None of them throw. So they are asserted.
 *
 * Run: node --experimental-strip-types lib/console/manifest-csv.test.ts
 */

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { pass++; } else { fail++; console.error('FAIL:', name, extra); }
}

const base: Manifest = {
  departureId: 'd1', startsOn: '2027-05-04', endsOn: '2027-05-11', startTime: '08:30:00',
  status: 'open', capacity: 12, seatsBooked: 3, seatsHeld: 1,
  packageId: 'p1', packageTitle: 'Kyoto in Spring', packageSlug: 'kyoto-in-spring',
  currency: 'CAD',
  fields: [
    { id: 'f1', label: 'Flight number', appliesTo: 'booking' },
    { id: 'f2', label: 'Passport', appliesTo: 'traveller' },
  ],
  bookings: [
    {
      id: 'b1', reference: 'EMP-0001', status: 'paid_in_full',
      leadName: 'Nguyen, Thi', leadEmail: 'thi@example.com', leadPhone: '+1 416 555 0101',
      adults: 2, children: 0, infants: 0, roomTypeName: 'Twin', singleSupplement: false,
      extras: [{ label: 'Tea ceremony', quantity: 2 }, { label: 'Transfer', quantity: 1 }],
      travellers: [
        { id: 't1', position: 1, travellerType: 'adult', legalName: 'Nguyen, Thi',
          dateOfBirth: '1984-02-11', isLead: true,
          dietaryNotes: 'No "shellfish"', accessibilityNotes: null,
          emergencyContact: { name: 'Minh', phone: '+1 416 555 0199', relationship: 'brother' } },
        { id: 't2', position: 2, travellerType: 'adult', legalName: 'Tran, Bao',
          dateOfBirth: null, isLead: false,
          dietaryNotes: null, accessibilityNotes: 'Line 1\nLine 2',
          emergencyContact: null },
      ],
      bookingResponses: { f1: 'AC 001' },
      travellerResponses: { t1: { f2: 'X1234567' }, t2: {} },
    },
  ],
  travellerCount: 2,
};

const csv = manifestToCsv(base);
const lines = csv.split('\r\n');

ok('header has all fixed columns plus custom fields',
  lines[0] === 'Booking,Booking status,Lead contact,Lead email,Lead phone,Room,Extras,Traveller,Type,Legal name,Date of birth,Dietary,Accessibility,Emergency contact,Flight number,Passport',
  lines[0]);
ok('one row per traveller, plus header, plus trailing blank', lines.length === 4, String(lines.length));
ok('ends with CRLF', csv.endsWith('\r\n'));

// A comma inside a value must be quoted, not split.
ok('comma in name is quoted', lines[1].includes('"Nguyen, Thi"'), lines[1]);
// An embedded double quote must be doubled AND the cell wrapped.
ok('embedded quote doubled', lines[1].includes('"No ""shellfish"""'), lines[1]);
// A newline inside a cell must be wrapped so the row does not break.
ok('newline in cell is wrapped', lines[2].includes('"Line 1\nLine 2"'), JSON.stringify(lines[2]));
// Booking-level answers repeat on every row of that booking; traveller-level do not.
ok('booking field repeats on both rows',
  lines[1].includes('AC 001') && lines[2].includes('AC 001'));
ok('traveller field only on its own row',
  lines[1].includes('X1234567') && !lines[2].includes('X1234567'));
// Semicolons need no quoting under RFC 4180 and the separator disambiguates a
// list of two extras from one extra whose label contains a comma.
ok('extras joined with quantity', lines[1].includes('Tea ceremony ×2; Transfer'), lines[1]);
ok('empty date of birth is empty, not "null"', !lines[2].includes('null'), lines[2]);

// Emergency contact formatting drops blanks rather than leaving separators.
ok('emergency contact joins present parts',
  formatEmergencyContact({ name: 'A', phone: '', relationship: 'sister' }) === 'A · sister');
ok('emergency contact of null is empty', formatEmergencyContact(null) === '');

ok('filename is findable', manifestFilename(base) === 'manifest-kyoto-in-spring-2027-05-04.csv',
  manifestFilename(base));

// An extra whose own label contains a comma must still be quoted as one cell.
const commaExtra: Manifest = {
  ...base,
  bookings: [{ ...base.bookings[0], extras: [{ label: 'Dinner, chef\u2019s table', quantity: 1 }] }],
};
ok('comma inside an extra label is quoted',
  manifestToCsv(commaExtra).split('\r\n')[1].includes('"Dinner, chef\u2019s table"'),
  manifestToCsv(commaExtra).split('\r\n')[1]);

// A manifest with nobody on it is still a valid CSV with a header.
const empty: Manifest = { ...base, bookings: [], travellerCount: 0 };
ok('empty manifest is header only', manifestToCsv(empty).split('\r\n').length === 2);

// The byte-order mark is what stops Excel on Windows mangling non-ASCII names.
ok('BOM is a single zero-width no-break space', CSV_BOM === '\uFEFF' && CSV_BOM.length === 1);
ok('BOM is not baked into the CSV itself', !manifestToCsv(base).startsWith(CSV_BOM));
const nonAscii: Manifest = {
  ...base,
  bookings: [{
    ...base.bookings[0],
    travellers: [{ ...base.bookings[0].travellers[0], legalName: 'Nguy\u1ec5n Th\u1ecb Minh' }],
  }],
};
ok('non-ASCII names survive unescaped',
  manifestToCsv(nonAscii).includes('Nguy\u1ec5n Th\u1ecb Minh'));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
