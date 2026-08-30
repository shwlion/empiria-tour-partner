import { requirePartner } from '@/lib/auth';
import { CSV_BOM, getManifest, manifestFilename, manifestToCsv } from '@/lib/console/manifests';

export const dynamic = 'force-dynamic';

/**
 * The manifest as CSV — one row per traveller.
 *
 * A route handler rather than a client-side blob, so the download works from a
 * plain link and so the same scope check guards the file as guards the page.
 * This is the most sensitive export in the product: names, dates of birth,
 * dietary and accessibility notes, next of kin. `no-store` keeps it out of
 * every cache between here and the partner's laptop.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requirePartner();
  const { id } = await params;
  const manifest = await getManifest(user.id, id);
  if (!manifest) return new Response('Not found', { status: 404 });

  // The BOM goes on here rather than inside the serialiser, so that function
  // returns CSV and nothing else. Without it Excel on Windows mangles every
  // non-ASCII name on the list.
  return new Response(CSV_BOM + manifestToCsv(manifest), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${manifestFilename(manifest)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
