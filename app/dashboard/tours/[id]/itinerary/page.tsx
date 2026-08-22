import { notFound } from 'next/navigation';
import { requirePartner } from '@/lib/auth';
import { getPackage } from '@/lib/console/packages';
import ItineraryForm from './ItineraryForm';

export const dynamic = 'force-dynamic';

export default async function ItineraryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePartner();
  const detail = await getPackage(id, user.id);
  if (!detail) notFound();

  return (
    <ItineraryForm
      packageId={detail.pkg.id}
      itinerary={detail.itinerary}
      inclusions={detail.inclusions}
    />
  );
}
