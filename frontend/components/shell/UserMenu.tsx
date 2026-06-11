'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface Props {
  user: { name: string; email: string };
}

export default function UserMenu({ user }: Props) {
  const [open, setOpen] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="user-menu">
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
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}