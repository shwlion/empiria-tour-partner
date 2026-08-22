import DashboardShell from '@/components/DashboardShell';
import Sidebar from '@/components/Sidebar';
import { Banner } from '@/components/ui';
import { requirePartner } from '@/lib/auth';
import { isDbWritable } from '@/lib/supabase';

/**
 * Every route below this is one partner's own data.
 *
 * The guard runs here and again inside every server action. A layout guard
 * protects pages; it does not protect mutations, and in this app the mutations
 * are the ones that could touch somebody else's tour.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePartner();
  const writable = isDbWritable();

  return (
    <DashboardShell sidebar={<Sidebar name={user.name} email={user.email} />}>
      {!writable && (
        <Banner tone="error">
          <p className="font-medium">This dashboard is read-only.</p>
          <p className="mt-1">
            <code className="rounded bg-black/5 px-1">SUPABASE_KEY</code> is not set, so nothing can
            be saved. See <code className="rounded bg-black/5 px-1">.env.local.example</code>.
          </p>
        </Banner>
      )}
      {children}
    </DashboardShell>
  );
}
