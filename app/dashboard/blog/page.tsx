import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth';
import { listMyPosts } from '@/lib/console/blog';
import BlogList from './BlogList';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Journal · Empiria Tour Partner' };

export default async function PartnerBlogPage() {
  const user = await requirePartner();
  return <BlogList posts={await listMyPosts(user.id)} />;
}
