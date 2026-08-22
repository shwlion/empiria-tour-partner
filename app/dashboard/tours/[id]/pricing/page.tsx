import { notFound } from 'next/navigation';
import { requirePartner } from '@/lib/auth';
import { getPackage, getPackageOptions } from '@/lib/console/packages';
import PricingForm from './PricingForm';

export const dynamic = 'force-dynamic';

export default async function PricingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePartner();
  const [detail, options] = await Promise.all([
    getPackage(id, user.id),
    getPackageOptions(),
  ]);
  if (!detail) notFound();

  return (
    <PricingForm
      pkg={detail.pkg}
      prices={detail.prices}
      currencies={options.currencies}
      policies={options.policies}
      canEdit
    />
  );
}
