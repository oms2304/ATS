'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/documents', label: 'Documents' },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
    }
  }, [])

  function handleLogout() {
    logout()
    router.push('/login')
  }

  const initial = user?.name?.charAt(0).toUpperCase() ?? 'J'

  return (
    <div className="min-h-screen bg-[#0b141c] text-[#dae3ee]">

      <nav
        style={{
          background: '#0b141c',
          borderBottom: '1px solid #414753',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          width: '100%',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 24px',
            height: '56px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: '20px',
              fontWeight: '700',
              color: '#dae3ee',
              letterSpacing: '-0.3px',
            }}
          >
            ATS for Job Seekers
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {NAV_LINKS.map(link => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    fontSize: '13px',
                    fontWeight: '500',
                    color: isActive ? '#dae3ee' : '#c1c6d6',
                    textDecoration: 'none',
                    padding: '6px 12px',
                    borderBottom: isActive
                      ? '2px solid #acc7ff'
                      : '2px solid transparent',
                    transition: 'color 0.15s',
                  }}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleLogout}
              style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#c1c6d6',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#acc7ff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#c1c6d6'
              }}
            >
              Logout
            </button>

            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#468fff',
                border: '1px solid #414753',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: '600',
                color: '#ffffff',
                userSelect: 'none',
              }}
            >
              {initial}
            </div>
          </div>
        </div>
      </nav>

      <main
        style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '24px',
        }}
      >
        {children}
      </main>

    </div>
  )
}
