import { notFound } from 'next/navigation';
import { requirePartner } from '@/lib/auth';
import { getPackage } from '@/lib/console/packages';
import OptionsForm from './OptionsForm';

export const dynamic = 'force-dynamic';

export default async function OptionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePartner();
  const detail = await getPackage(id, user.id);
  if (!detail) notFound();

  return (
    <OptionsForm
      packageId={detail.pkg.id}
      rooms={detail.rooms}
      extras={detail.extras}
      customFields={detail.customFields}
      currency={detail.pkg.currency}
      canEdit
    />
  );
}
