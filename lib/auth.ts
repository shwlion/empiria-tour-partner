import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from './supabase/config';
import { createClient } from './supabase/server';

/**
 * Who this app is for.
 *
 * Exactly one role, deliberately. Exhibit A has no supplier-facing surface at
 * all — Empiria is the seller of record for every booking — so this whole app
 * exists because the client asked for partner self-service on top of the
 * agreement. That makes its boundary the most important thing about it: a
 * partner sees their own tours and nothing else, ever.
 *
 * Administrators are refused rather than admitted with an empty catalogue.
 * Their `users` row has no `partner_id` to scope on, so every list here would
 * come back empty and look like a bug. They have their own console.
 */
export type PartnerUser = {
  id: string;
  email: string | null;
  name: string | null;
};

export async function requirePartner(): Promise<PartnerUser> {
  if (!isSupabaseConfigured()) redirect('/unauthorized?reason=unconfigured');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('users')
    .select('role, full_name, status')
    .eq('id', user.id)
    .maybeSingle();

  // A closed account keeps its role so it can be reopened, so status has to be
  // checked on its own. Without this, deactivating a partner would leave them
  // able to edit and publish tours Empiria sells.
  if (profile?.status === 'closed') {
    redirect('/unauthorized?reason=closed');
  }

  const role = profile?.role ?? 'traveller';
  if (role !== 'partner') {
    redirect(role === 'admin' || role === 'agent' ? '/unauthorized?reason=staff' : '/unauthorized');
  }

  return {
    id: user.id,
    email: user.email ?? null,
    name: (profile as { full_name?: string | null } | null)?.full_name ?? null,
  };
}

/**
 * The partner's own id, for scoping.
 *
 * A separate call from `requirePartner()` only so the intent reads clearly at
 * the call site: `listPackages(await partnerScope())` says what it does.
 */
export async function partnerScope(): Promise<string> {
  const user = await requirePartner();
  return user.id;
}
