import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export const metadata: Metadata = { title: 'No access · Empiria Tour Partner' };
export const dynamic = 'force-dynamic';

type Reason = { title: string; body: string; action?: { href: string; label: string } };

const REASONS: Record<string, Reason> = {
  unconfigured: {
    title: 'This dashboard is not connected',
    body:
      'The Supabase environment variables are missing, so there is no database to sign in against. Copy .env.local.example to .env.local and fill it in with the keys from the Tours project.',
  },
  staff: {
    title: 'Empiria staff have their own console',
    body:
      'This dashboard shows one partner their own tours, scoped to them. An administrator has no partner account to scope on, so everything here would come back empty — which would look like a fault rather than a boundary.',
  },
};

const DEFAULT: Reason = {
  title: 'This account is not a partner',
  body:
    'Signing in worked, but this account has no partner access. If that is wrong, Empiria can change your role.',
};

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const copy = (reason && REASONS[reason]) || DEFAULT;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <ShieldAlert size={28} className="text-primary" aria-hidden="true" />
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">{copy.title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{copy.body}</p>

      <div className="mt-6 flex flex-wrap gap-3">
        {copy.action && (
          <Link
            href={copy.action.href}
            className="rounded-lg bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
          >
            {copy.action.label}
          </Link>
        )}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
