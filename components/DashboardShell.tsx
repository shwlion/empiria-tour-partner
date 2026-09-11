'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Menu } from 'lucide-react';

/**
 * Responsive chrome: a static sidebar from md up, a slide-in drawer below it.
 *
 * The drawer closes when a link inside it is activated, not when the path
 * changes. That sounds like the same thing and is not: reacting to the path
 * meant an effect that called setState on every navigation, which React 19
 * rightly rejects — a drawer closing is a consequence of somebody clicking,
 * which is an event. Delegating the click also survives the sidebar being
 * passed in as an opaque ReactNode, and catches keyboard activation, since
 * pressing Enter on a link fires a click too.
 */
export default function DashboardShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Escape closes it, as a dialog-like overlay should.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="flex h-screen bg-gray-50">
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a')) setOpen(false);
        }}
        className={`fixed inset-y-0 left-0 z-40 flex w-64 transform flex-col border-r border-gray-200 bg-white transition-transform duration-200 ease-in-out md:static md:z-auto md:translate-x-0 md:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={open}
            className="-ml-1.5 rounded-lg p-1.5 text-gray-700 transition-colors hover:bg-gray-100"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <Image src="/logo.png" alt="Empiria Tours" width={1507} height={522} className="h-7 w-auto" priority />
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
