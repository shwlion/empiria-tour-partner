import Link from 'next/link';
import {
  LayoutDashboard,
  MapPinned,
  PlusCircle,
  CreditCard,
  Tag,
  RotateCcw,
  Settings,
  LogOut,
  User,
} from 'lucide-react';
import DashboardShell from '@/components/DashboardShell';
import { requireRole } from '@/lib/auth';

/**
 * Partner dashboard chrome (sidebar), ported from the organizer app and
 * retargeted events → tours. Gated by the partner role via requireRole(); in
 * design-shell mode (no Supabase env) the guard is a pass-through so this still
 * renders with sample data.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole('partner');

  const menuItems: { name: string; href: string; icon: React.ElementType; badge?: number }[] = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Tours', href: '/dashboard', icon: MapPinned },
    { name: 'Create Tour', href: '/dashboard', icon: PlusCircle },
    { name: 'Payments', href: '/dashboard', icon: CreditCard },
    { name: 'Coupons', href: '/dashboard', icon: Tag },
    { name: 'Refunds', href: '/dashboard', icon: RotateCcw, badge: 2 },
    { name: 'Settings', href: '/dashboard', icon: Settings },
  ];

  const sidebar = (
    <>
      <div className="border-b border-gray-100 p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Empiria Tour" className="h-9 w-auto" />
        <span className="mt-2 block text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          Partner
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {menuItems.map((item, i) => (
          <Link
            key={item.name}
            href={item.href}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              i === 0
                ? 'bg-gray-100 text-black'
                : 'text-gray-700 hover:bg-gray-100 hover:text-black'
            }`}
          >
            <item.icon size={18} />
            {item.name}
            {item.badge ? (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {/* User footer (sample — replace with the signed-in partner once auth lands) */}
      <div className="border-t border-gray-100 p-4">
        <div className="mb-4 flex items-center gap-3 px-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500">
            <User size={18} />
          </div>
          <div className="min-w-0 text-xs">
            <div className="truncate font-semibold text-gray-900">Atlas Journeys Co.</div>
            <div className="truncate text-gray-500">{user?.email ?? 'partner@atlasjourneys.com'}</div>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-black"
        >
          <User size={18} />
          My Profile
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </form>
      </div>
    </>
  );

  return <DashboardShell sidebar={sidebar}>{children}</DashboardShell>;
}
