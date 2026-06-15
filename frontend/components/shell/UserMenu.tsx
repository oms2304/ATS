'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface Props {
  user: { name: string; email: string };
}

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    logout();
    router.push('/login');
  };

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu__trigger"
        onClick={() => setOpen(prev => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="User menu"
      >
        <span className="user-avatar">
          {user.name.charAt(0).toUpperCase()}
        </span>
      </button>

      {open && (
        <div className="user-menu__dropdown" role="menu">
          <div className="user-menu__info">
            <p className="user-menu__name">{user.name}</p>
            <p className="user-menu__email">{user.email}</p>
          </div>
          <hr />
          <button
            className="user-menu__logout"
            onClick={handleLogout}
            role="menuitem"
          >
            <svg
              className="user-menu__logout-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}