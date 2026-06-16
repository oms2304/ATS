'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import UserMenu from './UserMenu';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  // { label: 'Documents', href: '/documents' },
  { label: 'Profile',   href: '/profile'   },
  { label: 'Settings',  href: '/settings'  },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link href="/dashboard">ATS for Job Seekers</Link>
      </div>

      <ul className="navbar-links">
        {NAV_ITEMS.map(({ label, href }) => (
          <li key={href}>
            <Link
              href={href}
              className={`nav-link ${pathname.startsWith(href) ? 'nav-link--active' : ''}`}
              aria-current={pathname.startsWith(href) ? 'page' : undefined}
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>

      {user && <UserMenu user={user} />}
    </nav>
  );
}