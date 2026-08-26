'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/', label: 'Home' },
  { href: '/work', label: 'Work' },
  { href: '/personal', label: 'Personal' },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`nav-tab ${pathname === tab.href ? 'active' : ''}`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
