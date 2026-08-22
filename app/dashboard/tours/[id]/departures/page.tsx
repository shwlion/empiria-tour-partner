import { notFound } from 'next/navigation';
import { requirePartner } from '@/lib/auth';
import { getPackage } from '@/lib/console/packages';
import { listDeparturesForPackage } from '@/lib/console/departures';
import DeparturesForm from './DeparturesForm';

export const dynamic = 'force-dynamic';

export default async function DeparturesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePartner();
  const detail = await getPackage(id, user.id);
  if (!detail) notFound();

  const departures = await listDeparturesForPackage(id, user.id);
  const typical = departures.length
    ? Math.round(departures.reduce((n, d) => n + d.capacity, 0) / departures.length)
    : 12;

  return (
    <DeparturesForm
      packageId={detail.pkg.id}
      departures={departures}
      currency={detail.pkg.currency}
      defaultCapacity={typical}
    />
  );
}
