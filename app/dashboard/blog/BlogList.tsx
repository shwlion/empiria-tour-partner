'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Pencil, Plus } from 'lucide-react';
import { Badge, Banner, Button, Card, EmptyState, PageHeader } from '@/components/ui';
import type { ActionResult } from '@/lib/actions';
import type { PartnerBlogPost } from '@/lib/console/blog';
import { publishPostAction, retirePostAction } from './actions';

/**
 * A partner's own posts.
 *
 * A post Empiria has taken down shows the reason here rather than failing
 * quietly, and its publish control is replaced by an explanation: a button
 * that always errors teaches nothing, and the author's next move is to talk to
 * Empiria, not to click again.
 */

type Notice = { ok: boolean; text: string };

export default function BlogList({ posts }: { posts: PartnerBlogPost[] }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await fn();
      setNotice({ ok: result.ok, text: result.ok ? (result.message ?? 'Done.') : result.message });
    });

  return (
    <>
      <PageHeader
        title="Journal"
        description="Write about your tours and the places you run them. Posts appear on Empiria's site under your name."
        actions={
          <Link href="/dashboard/blog/new">
            <Button>
              <Plus size={14} aria-hidden="true" />
              New post
            </Button>
          </Link>
        }
      />

      {notice && (
        <div className="mb-4">
          <Banner tone={notice.ok ? 'success' : 'error'}>{notice.text}</Banner>
        </div>
      )}

      {posts.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="A post is a good way to say what a trip is actually like — the walk, the food, the ferry that only runs on Tuesdays."
          action={
            <Link href="/dashboard/blog/new">
              <Button>Write the first one</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <Card key={post.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[15px] font-semibold text-foreground">{post.title}</h2>
                    <Badge value={post.takenDown ? 'taken down' : post.status} />
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    Updated {new Date(post.updatedAt).toLocaleString('en-CA')}
                  </p>

                  {post.takenDown && post.unpublishReason && (
                    <p className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[12px] leading-relaxed text-destructive">
                      Empiria took this down
                      {post.unpublishedAt &&
                        ` on ${new Date(post.unpublishedAt).toLocaleDateString('en-CA')}`}
                      : {post.unpublishReason}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link href={`/dashboard/blog/${post.id}`}>
                    <Button variant="secondary">
                      <Pencil size={14} aria-hidden="true" />
                      Edit
                    </Button>
                  </Link>

                  {post.takenDown ? (
                    // No control at all: only an administrator can put it back,
                    // so offering a button would be offering a refusal.
                    <p className="max-w-[16rem] text-[12px] leading-relaxed text-muted-foreground">
                      Only Empiria can publish this again. Reply to their note if you think it
                      should go back up.
                    </p>
                  ) : post.status === 'published' ? (
                    <Button
                      variant="secondary"
                      disabled={pending}
                      onClick={() => run(() => retirePostAction(post.id))}
                    >
                      {pending ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <EyeOff size={14} aria-hidden="true" />
                      )}
                      Back to draft
                    </Button>
                  ) : (
                    <Button
                      disabled={pending}
                      onClick={() => run(() => publishPostAction(post.id))}
                    >
                      {pending ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Eye size={14} aria-hidden="true" />
                      )}
                      Publish
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
