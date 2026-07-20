import Link from 'next/link';
import { TrendingUp, Ticket, MapPinned, ShoppingBag, ArrowRight } from 'lucide-react';
import RevenueChart from '@/components/RevenueChart';
import { formatCurrency } from '@/lib/utils';
import { SAMPLE_TOURS, SAMPLE_STATS, REVENUE_SERIES, CURRENCY } from '@/lib/sample';

export default function DashboardHome() {
  const s = SAMPLE_STATS;
  const recentTours = SAMPLE_TOURS.slice(0, 5);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">Partner Overview</h1>
          <p className="mt-0.5 text-sm text-gray-500">Your tours, tickets, and payouts at a glance.</p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d6420f] hover:shadow-lg active:translate-y-0"
        >
          + Create Tour
        </Link>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Payout"
          value={formatCurrency(s.totalRevenue, CURRENCY)}
          sub={`${formatCurrency(s.revenueThisMonth, CURRENCY)} this month`}
          icon={<TrendingUp size={18} />}
          color="green"
        />
        <StatCard
          label="Tickets Sold"
          value={s.ticketsSold.toLocaleString()}
          sub={`Across ${SAMPLE_TOURS.length} tours`}
          icon={<Ticket size={18} />}
          color="blue"
        />
        <StatCard
          label="Active Tours"
          value={s.activeTours.toString()}
          sub={`${s.draftTours} draft`}
          icon={<MapPinned size={18} />}
          color="orange"
        />
        <StatCard
          label="Total Orders"
          value={s.totalOrders.toLocaleString()}
          sub="Completed payments"
          icon={<ShoppingBag size={18} />}
          color="purple"
        />
      </div>

      {/* Revenue chart */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-gray-900">All-Time Payout</h2>
            <p className="mt-0.5 text-xs text-gray-400">Cumulative partner payout over time</p>
          </div>
          <span className="text-2xl font-bold text-primary">{formatCurrency(s.totalRevenue, CURRENCY)}</span>
        </div>
        <RevenueChart series={REVENUE_SERIES} currency={CURRENCY} />
      </div>

      {/* Recent tours */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 p-5">
          <h2 className="font-bold text-gray-900">Recent Tours</h2>
          <Link href="/dashboard" className="flex items-center gap-1 text-sm text-gray-500 hover:text-black">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentTours.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-4 transition-colors hover:bg-gray-50">
              <div className="flex min-w-0 items-center gap-4">
                <StatusBadge status={t.status} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{t.title}</p>
                  <p className="text-xs text-gray-500">
                    {t.city} ·{' '}
                    {new Date(t.startAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="ml-4 flex-shrink-0 text-right">
                <p className="text-sm font-medium text-gray-900">
                  {t.sold}/{t.capacity}
                </p>
                <p className="text-xs text-gray-500">tickets sold</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'orange' | 'purple';
}) {
  const colors = {
    green: 'bg-green-50 text-green-600',
    blue: 'bg-blue-50 text-blue-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="cursor-default rounded-xl border border-gray-200 bg-white p-5 transition-all duration-200 hover:-translate-y-1 hover:border-gray-300 hover:shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <div className={`rounded-lg p-2 ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    published: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
    completed: 'bg-blue-100 text-blue-600',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${styles[status] || styles.draft}`}>
      {status}
    </span>
  );
}
