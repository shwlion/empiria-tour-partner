'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, MapPinned, PlusCircle, CalendarRange, LogOut,
} from 'lucide-react';

/**
 * The partner sidebar.
 *
 * Only sections that exist are linked. The scaffold listed Payments, Coupons,
 * Refunds and Settings, all pointing at /dashboard — a menu of promises, and
 * the kind of thing a client clicks through in a demo and remembers as broken.
 */
const ITEMS = [
  { name: 'Overview', href: '/dashboard', icon: LayoutDashboard, exact: true },
  { name: 'My tours', href: '/dashboard/tours', icon: MapPinned },
  { name: 'New tour', href: '/dashboard/tours/new', icon: PlusCircle, exact: true },
  { name: 'Departures', href: '/dashboard/departures', icon: CalendarRange },
];

export default function Sidebar({ name, email }: { name: string | null; email: string | null }) {
  const pathname = usePathname();
  const label = name ?? email ?? 'Partner';
  const initials = (name ?? email ?? 'P')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <>
      <div className="border-b border-gray-100 p-6">
        <Image src="/logo.png" alt="Empiria Tour" width={140} height={36} className="h-9 w-auto" priority />
        <span className="mt-2 block text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          Partner
        </span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4" aria-label="Sections">
        {ITEMS.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? 'bg-gray-100 text-black' : 'text-gray-700 hover:bg-gray-100 hover:text-black'
              }`}
            >
              <item.icon size={18} aria-hidden="true" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-bold text-white">
            {initials || 'P'}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-gray-900">{label}</div>
            <div className="truncate text-[11px] text-gray-500">{email}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              aria-label="Sign out"
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
