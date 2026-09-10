import type { Metadata } from 'next';
import { requirePartner } from '@/lib/auth';
import { myBlogLinkOptions } from '@/lib/console/blog';
import PostEditor from '../PostEditor';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'New post · Empiria Tour Partner' };

export default async function NewPostPage() {
  const user = await requirePartner();
  return <PostEditor post={null} options={await myBlogLinkOptions(user.id)} />;
}
