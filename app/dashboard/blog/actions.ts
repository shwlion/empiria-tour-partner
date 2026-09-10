'use server';

import { revalidatePath } from 'next/cache';
import { requirePartner } from '@/lib/auth';
import { requireWritableDb } from '@/lib/supabase';
import { recordAudit, diff } from '@/lib/audit';
import { explain, fail, nullable, ok, text, type ActionResult } from '@/lib/actions';
import { uniqueSlug } from '@/lib/blogSlug';
import { validateBlogImage, blogObjectPath } from '@/lib/blogUpload';

/**
 * A partner writing on Empiria's site.
 *
 * Every action re-reads the row with `author_id` pinned to the caller. The
 * console holds the service role, so nothing in the database would stop a
 * partner editing somebody else's post — the scope is this file's job, exactly
 * as it is for tours.
 *
 * Publishing goes through `publish_blog_post`, which is where the rule that
 * matters lives: a partner may not put back what an administrator took down.
 *
 * See docs/BLOG.md in the storefront repo.
 */

const REVALIDATE = '/dashboard/blog';

export async function savePostAction(
  id: string | null,
  _prev: ActionResult<{ id: string }> | null,
  form: FormData
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePartner();

  const title = text(form.get('title'));
  const body = text(form.get('body'));
  if (!title) return fail('The post needs a title.', { title: 'Required' });
  if (!body) return fail('An empty post is worse than no post — it looks deliberate.', { body: 'Required' });

  try {
    const db = requireWritableDb();

    const fields = {
      title,
      body,
      excerpt: nullable(form.get('excerpt')),
      hero_image: nullable(form.get('hero_image')),
      package_id: nullable(form.get('package_id')),
      destination_id: nullable(form.get('destination_id')),
    };

    if (!id) {
      const { data, error } = await db
        .from('blog_posts')
        .insert({ ...fields, slug: await uniqueSlug(title), author_id: user.id })
        .select('id, slug')
        .single();
      if (error || !data) return fail(explain(error));

      await recordAudit(db, user, {
        entity: 'blog_post',
        entityId: data.id,
        action: 'create',
        after: { ...fields, slug: data.slug },
        summary: `Created “${title}”`,
      });
      revalidatePath(REVALIDATE);
      return ok({ id: data.id }, 'Saved as a draft.');
    }

    // Pinned to the author: someone else's post is not found, not forbidden.
    const { data: before } = await db
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .eq('author_id', user.id)
      .maybeSingle();
    if (!before) return fail('That post no longer exists.');

    const next: typeof fields & { slug?: string } = { ...fields };
    if (!before.published_at) next.slug = await uniqueSlug(title, id);

    const { error } = await db
      .from('blog_posts')
      .update(next)
      .eq('id', id)
      .eq('author_id', user.id);
    if (error) return fail(explain(error));

    const changes = diff(before as Record<string, unknown>, next);
    if (changes) {
      await recordAudit(db, user, {
        entity: 'blog_post',
        entityId: id,
        action: 'update',
        ...changes,
        summary: `Edited “${title}”`,
      });
    }
    revalidatePath(REVALIDATE);
    return ok({ id }, 'Saved.');
  } catch (error) {
    return fail(explain(error));
  }
}

/**
 * Publish, or find out you cannot.
 *
 * The refusal comes from the database rather than from a check here, so it
 * holds even if this screen forgets to hide the button.
 */
export async function publishPostAction(id: string): Promise<ActionResult> {
  const user = await requirePartner();
  try {
    const db = requireWritableDb();
    const { data: before } = await db
      .from('blog_posts')
      .select('title, status')
      .eq('id', id)
      .eq('author_id', user.id)
      .maybeSingle();
    if (!before) return fail('That post no longer exists.');

    const { error } = await db.rpc('publish_blog_post', { p_post: id, p_actor: user.id });
    if (error) {
      return fail(
        /took this post down/i.test(error.message)
          ? 'Empiria took this post down, so it cannot be published again from here.'
          : explain(error)
      );
    }

    await recordAudit(db, user, {
      entity: 'blog_post',
      entityId: id,
      action: 'publish',
      before: { status: before.status },
      after: { status: 'published' },
      summary: `Published “${before.title}”`,
    });
    revalidatePath(REVALIDATE);
    return ok(undefined, 'Published. It is live on the site now.');
  } catch (error) {
    return fail(explain(error));
  }
}

/**
 * A partner may retire their own post while it is live, which is ordinary
 * housekeeping and not moderation: no reason is recorded and `unpublished_by`
 * stays null, so they can publish it again. Only an administrator's takedown
 * sets that field and locks it.
 */
export async function retirePostAction(id: string): Promise<ActionResult> {
  const user = await requirePartner();
  try {
    const db = requireWritableDb();
    const { data: before } = await db
      .from('blog_posts')
      .select('title, status, unpublished_by')
      .eq('id', id)
      .eq('author_id', user.id)
      .maybeSingle();
    if (!before) return fail('That post no longer exists.');
    if (before.unpublished_by) {
      return fail('Empiria has already taken this post down.');
    }

    const { error } = await db
      .from('blog_posts')
      .update({ status: 'draft' })
      .eq('id', id)
      .eq('author_id', user.id);
    if (error) return fail(explain(error));

    await recordAudit(db, user, {
      entity: 'blog_post',
      entityId: id,
      action: 'unpublish',
      before: { status: before.status },
      after: { status: 'draft' },
      summary: `Took “${before.title}” back to a draft`,
    });
    revalidatePath(REVALIDATE);
    return ok(undefined, 'Back to a draft. It is off the site.');
  } catch (error) {
    return fail(explain(error));
  }
}

/** Pictures are uploaded, never linked — see docs/BLOG.md. */
export async function uploadPostImageAction(
  _prev: ActionResult<{ url: string }> | null,
  form: FormData
): Promise<ActionResult<{ url: string }>> {
  const user = await requirePartner();

  const file = form.get('file');
  if (!(file instanceof File)) return fail('Choose a file to upload.');

  const check = await validateBlogImage(file);
  if (!check.ok) return fail(check.reason);

  try {
    const db = requireWritableDb();
    const path = blogObjectPath(user.id, check.ext);
    const { error } = await db.storage
      .from('blog')
      .upload(path, file, { contentType: check.contentType, upsert: false });
    if (error) return fail(explain(error));

    const { data } = db.storage.from('blog').getPublicUrl(path);
    return ok({ url: data.publicUrl }, 'Uploaded.');
  } catch (error) {
    return fail(explain(error));
  }
}
