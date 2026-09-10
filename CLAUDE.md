# Empiria Tours — partner dashboard

One tour operator's own dashboard. Third of three separate repositories sharing
one Supabase project, all under `~/Documents/Elevsoft/Empiria Tours/` — **that
path contains a space**, so quote it.

| Repo | Dev port |
| --- | --- |
| `empiria-tour` — public storefront, Stripe webhook, email outbox | 3000 |
| `empiria-tour-admin` — Empiria's console | 3001 |
| `empiria-tour-partner` — this one | 3002 |

Broad project state and the contract live in
`empiria-tour/empiria-tour/docs/PROJECT.md`.

## Read this before changing anything

**Exhibit A has no supplier-facing surface at all.** §2.2 makes Empiria the
seller of record for every booking. This whole application exists because the
client asked for partner self-service, and it is **outside the agreement**,
awaiting a change order under §1.4.

That makes its boundary the most important thing about it: **a partner sees
their own tours and never anybody else's.** Everything below follows from that.

## Three enforcement layers

1. **Data functions require a partner id.** In the admin repo `partnerId` is an
   optional narrowing; here it is `partnerId: string` as the **first** parameter,
   applied unconditionally, and `requireScope()` refuses an empty string — which
   is the shape a forgotten `user.id` actually takes.
2. **Every mutation re-reads the owner before writing.** The page that rendered
   the form already checked, but a form can be replayed against a different id
   and nothing in the request would say so.
3. **`partner_id` on create comes from the session, never a form field.** A
   `partner_id` that arrives in a request is one somebody can change.

Administrators are **refused**, not admitted with an empty catalogue — they have
no `partner_id` to scope on, so every list would return nothing and read as a
fault rather than a boundary. Status is checked separately from role, because a
closed account keeps its role in order to be reopened.

## The audit script — run it

```bash
npm run check      # tsc + eslint + scope audit + tests
npm run audit:scope
```

`scripts/audit-scope.mjs` enforces three rules:

1. A read touching `packages` / `departures` / `bookings` / `blog_posts`
   applies an owner filter — `partner_id`, or `author_id` for posts — somewhere
   in the same function. Child tables reached by a parent id need none —
   getting the parent id already required a scoped read. A read that is global
   on purpose says so in its body with `audit-scope: global read — <why>`;
   `grep -rn 'audit-scope: global read' lib/` is the complete list of places the
   boundary is deliberately not applied, and today it is one — `uniqueSlug`,
   because `/blog/<slug>` is a namespace shared with Empiria.
2. Every server action reaches ownership before it writes — an owner re-read, a
   local helper that does one (recognised by reading its body, not its name),
   stamping the owner column on insert, or pinning it in the query with
   `.eq('author_id', user.id)`. The last is the strongest: it sits in the WHERE
   clause of the write, so somebody else's row is never matched rather than
   rejected afterwards.
3. No route under `app/dashboard` renders without `requirePartner()`.

It exists because auditing by hand found **two real holes**:
`deleteDepartureAction` never checked who owned the tour, and
`listDeparturesForPackage` carried no scope at all — safe only because its one
caller happened to check first, which is protection by call order. It has been
negative-tested by reintroducing both plus an unguarded page; it caught all
three. **Re-test it that way whenever a rule changes** — a check that never fails
is worth nothing. The current rules were re-tested against six reintroduced
holes and caught all six.

**It has already failed that way once.** `ROOT` came from `import.meta.url`
via `.pathname`, which percent-encodes — so under a directory called
`Empiria Tours` it resolved to `Empiria%20Tours`, every `readdir` threw, and
`npm run check` reported a crash where it should have reported findings. It
uses `fileURLToPath` now. A guard that cannot run is a guard that is not
there, and this one could not run for as long as it has lived at this path.

## The types are narrower on purpose

`lib/console/bookings.ts` and `manifests.ts` are **deliberately not mirrored**
from the admin repo. A partner sees less of a booking than staff do, and the
safe way to say so is a type with no field for the rest — a field that is not
there cannot leak; one you forgot to omit from the JSX can.

Absent on purpose:

- **`notes_internal`** — Empiria's staff write those about a customer assuming
  only Empiria reads them.
- **The payments ledger** — §2.2 makes Empiria merchant of record; Stripe refs
  and processor fees are its record.
- **Part D acknowledgement snapshots** — a compliance record, not to be spread.

Contact details **are** included: `manageCustomers: false` means no searchable
directory of everyone who ever booked, not that the operator running Tuesday's
departure may not phone a delayed traveller.

**Copying a change across from `lib/admin/` without reading it is how
`notes_internal` gets back in.**

`lib/console/packages.ts` and `departures.ts` *are* mirrored from the admin repo
and should be kept in step. So are `lib/supabase.ts`, `lib/audit.ts`,
`lib/actions.ts`, `lib/money.ts`, `components/ui.tsx` and `lib/database.types.ts`.

## Other decisions

- **The booking detail is read-only.** Every lever that moves money or seats
  belongs to Empiria's console; a row of disabled buttons would only teach a
  partner to ask why they are grey.
- **Supplier cost is shown, not editable** — §4.6 settles against it, and it says
  "not yet recorded" rather than a zero that would read as "you get nothing".
- **Manifests list committed bookings only.** A `pending_payment` booking is a
  hold with a timer on it, not a passenger.
- **Payouts are deliberately absent.** The scaffold drew a revenue chart from 56
  lines of invented numbers on the one screen where being wrong about money
  matters most. Revenue share needs supplier costs Empiria has not entered.
- **CSV exports carry a UTF-8 BOM**, or Excel on Windows mangles every non-ASCII
  name on a passenger list.

## Before it runs

`.env.local` needs **four** variables — the `NEXT_PUBLIC_` pair plus
`SUPABASE_URL` and `SUPABASE_KEY` (service role). An empty value passes a "key
present" check and still fails; check lengths, not presence.

Testing needs a `users` row with `role = 'partner'` and at least one package
carrying that `partner_id`. **A partner cannot be created by hand** — approval of
an application in the admin console is the only path, by design.

## Not built

Mirroring B3's tail; partner sub-users (one account per partner today, so an
agency cannot add its own staff); anything to do with payouts.
