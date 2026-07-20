/**
 * Sample data for the partner dashboard design shell.
 *
 * This app renders WITHOUT a database. Once Supabase (+ Supabase Auth) is wired
 * up, replace these with real queries scoped to the signed-in partner. The
 * shapes mirror what the organizer app fetches, retargeted from events → tours.
 */

export const CURRENCY = 'cad';

export interface PartnerTour {
  id: string;
  title: string;
  status: 'published' | 'draft' | 'cancelled' | 'completed';
  sold: number;
  capacity: number;
  startAt: string; // ISO
  city: string;
}

export const SAMPLE_TOURS: PartnerTour[] = [
  { id: '1', title: 'Old Montréal After Dark: Lantern Walk', status: 'published', sold: 142, capacity: 160, startAt: '2026-08-02T19:00:00-04:00', city: 'Montréal' },
  { id: '2', title: 'Kyoto Tea Houses & Hidden Gardens', status: 'published', sold: 38, capacity: 40, startAt: '2026-08-09T09:30:00+09:00', city: 'Kyoto' },
  { id: '3', title: 'Lisbon Fado Nights: Alfama Quarter', status: 'published', sold: 76, capacity: 120, startAt: '2026-08-15T20:00:00+01:00', city: 'Lisbon' },
  { id: '4', title: 'Oaxaca Market & Mezcal Tasting', status: 'draft', sold: 0, capacity: 30, startAt: '2026-09-01T11:00:00-06:00', city: 'Oaxaca' },
  { id: '5', title: 'Marrakech Medina: Artisans & Riads', status: 'published', sold: 54, capacity: 60, startAt: '2026-08-22T10:00:00+01:00', city: 'Marrakech' },
  { id: '6', title: 'Reykjavík Coastline & Folklore', status: 'completed', sold: 90, capacity: 90, startAt: '2026-06-14T18:00:00+00:00', city: 'Reykjavík' },
];

export const SAMPLE_STATS = {
  totalRevenue: 84920,
  revenueThisMonth: 12640,
  ticketsSold: 528,
  activeTours: 4,
  draftTours: 1,
  totalOrders: 411,
};

/**
 * Cumulative payout series (most recent 12 buckets). The chart slices this for
 * the shorter periods. Deterministic so server + client render identically.
 */
export const REVENUE_SERIES: { label: string; value: number }[] = [
  { label: 'Aug', value: 4200 },
  { label: 'Sep', value: 9100 },
  { label: 'Oct', value: 15300 },
  { label: 'Nov', value: 24800 },
  { label: 'Dec', value: 33600 },
  { label: 'Jan', value: 39200 },
  { label: 'Feb', value: 46100 },
  { label: 'Mar', value: 52700 },
  { label: 'Apr', value: 61400 },
  { label: 'May', value: 68900 },
  { label: 'Jun', value: 76200 },
  { label: 'Jul', value: 84920 },
];
