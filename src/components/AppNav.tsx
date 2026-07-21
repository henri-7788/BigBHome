'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: '🏠 WG Route Finder' },
  { href: '/commute', label: '🗺️ Pendel-Heatmap' },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              active ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
