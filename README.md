# Empiria Tour — Partner

Partner (organizer) dashboard for **Empiria Tour**. Standalone app — it does
**not** share auth/cookies with the other Empiria apps and will use **Supabase
Auth**. Design system is ported from `empiria-organizer` (shadcn/OKLCH tokens,
brand orange `#F15A29`, Geist, sidebar shell), retargeted events → tours.

```bash
bun install
bun --bun next dev   # http://localhost:3000  → redirects to /dashboard
```

## What's here (design shell)

- `app/globals.css` — organizer design tokens
- `app/dashboard/` — sidebar layout + designed **Partner Overview** (KPI cards,
  revenue chart, recent tours) rendered from `lib/sample.ts`
- `components/` — `DashboardShell`, `RevenueChart` (inline-SVG area chart)

## TODO

- [ ] Wire **Supabase Auth**; gate `/dashboard` by the partner role on `users`
- [ ] Replace `lib/sample.ts` with real Supabase queries scoped to the partner
- [ ] Build out My Tours / Create Tour / Payments / Coupons / Refunds / Settings
