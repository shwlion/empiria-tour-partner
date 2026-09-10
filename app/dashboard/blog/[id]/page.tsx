import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePartner } from '@/lib/auth';
import { getMyPost, myBlogLinkOptions } from '@/lib/console/blog';
import PostEditor from '../PostEditor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit post · Empiria Tour Partner' };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePartner();
  const [post, options] = await Promise.all([getMyPost(id, user.id), myBlogLinkOptions(user.id)]);
  // Somebody else's post is not found rather than forbidden — the same answer
  // a slug that never existed gets.
  if (!post) notFound();
  return <PostEditor post={post} options={options} />;
}
