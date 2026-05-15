import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WG Route Finder',
  description: 'WG-Gesucht Inserate analysieren und Fahrtzeit zur Arbeit berechnen',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
