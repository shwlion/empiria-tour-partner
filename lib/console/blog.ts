import { getSupabaseAdmin } from '@/lib/supabase';

/**
 * The partner's own posts, and nothing else.
 *
 * Every query filters on `author_id`. RLS is not the guard here — the console
 * acts as `service_role`, exactly as it does for tours — so the scope is the
 * application's job and it belongs in one place rather than at each call site.
 *
 * See docs/BLOG.md in the storefront repo.
 */

export type BlogStatus = 'draft' | 'published' | 'unpublished';

export type PartnerBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  heroImage: string | null;
  status: BlogStatus;
  publishedAt: string | null;
  updatedAt: string;
  packageId: string | null;
  destinationId: string | null;
  /** Set means an administrator took it down; only they can put it back. */
  takenDown: boolean;
  unpublishReason: string | null;
  unpublishedAt: string | null;
};

const SELECT = `
  id, slug, title, excerpt, body, hero_image, status, published_at, updated_at,
  package_id, destination_id, unpublished_by, unpublished_at, unpublish_reason
`;

type Row = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string;
  hero_image: string | null;
  status: BlogStatus;
  published_at: string | null;
  updated_at: string;
  package_id: string | null;
  destination_id: string | null;
  unpublished_by: string | null;
  unpublished_at: string | null;
  unpublish_reason: string | null;
};

function toPost(row: Row): PartnerBlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    heroImage: row.hero_image,
    status: row.status,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    packageId: row.package_id,
    destinationId: row.destination_id,
    takenDown: row.unpublished_by !== null,
    unpublishReason: row.unpublish_reason,
    unpublishedAt: row.unpublished_at,
  };
}

export async function listMyPosts(authorId: string): Promise<PartnerBlogPost[]> {
  const db = getSupabaseAdmin();
  if (!db) return [];
  const { data, error } = await db
    .from('blog_posts')
    .select(SELECT)
    .eq('author_id', authorId)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return (data as unknown as Row[]).map(toPost);
}

/** Null when the post is somebody else's, which is the same answer as missing. */
export async function getMyPost(id: string, authorId: string): Promise<PartnerBlogPost | null> {
  const db = getSupabaseAdmin();
  if (!db || !id) return null;
  const { data, error } = await db
    .from('blog_posts')
    .select(SELECT)
    .eq('id', id)
    .eq('author_id', authorId)
    .maybeSingle();
  if (error || !data) return null;
  return toPost(data as unknown as Row);
}

/**
 * What a post may be attached to: this partner's own tours, and any published
 * destination. Offering somebody else's tour would let a partner advertise on
 * a competitor's page.
 */
export async function myBlogLinkOptions(authorId: string): Promise<{
  packages: { id: string; title: string }[];
  destinations: { id: string; name: string }[];
}> {
  const db = getSupabaseAdmin();
  if (!db) return { packages: [], destinations: [] };
  const [pkgs, dests] = await Promise.all([
    db.from('packages').select('id, title').eq('partner_id', authorId).order('title'),
    db.from('destinations').select('id, name').eq('status', 'published').order('name'),
  ]);
  return {
    packages: (pkgs.data ?? []) as { id: string; title: string }[],
    destinations: (dests.data ?? []) as { id: string; name: string }[],
  };
}
