import { redirect } from 'next/navigation';

// The partner app opens straight onto the dashboard. Once Supabase Auth is
// wired, gate this behind a session check and redirect anonymous users to /login.
export default function Home() {
  redirect('/dashboard');
}
