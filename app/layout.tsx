import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Empiria Tour — Partner Dashboard',
  description: 'Manage your tours, tickets, and payouts.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // Forced light: the dashboard uses explicit light surfaces (parity with the organizer app).
    <html lang="en" className="light">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
