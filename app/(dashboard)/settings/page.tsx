'use client'

import { useState } from 'react'
import { useAuth } from '@/context/AuthContext'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const [showConfirm, setShowConfirm] = useState(false)

  return (
    <div className="min-h-screen bg-[#0d1117] p-6 text-[#e6edf3]">
      <div className="max-w-2xl mx-auto">

        <h1 className="text-2xl font-semibold text-white mb-6">Settings</h1>

        {/* Account Section */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg mb-4">
          <div className="px-6 py-4 border-b border-[#30363d]">
            <h2 className="text-base font-semibold text-white">Account</h2>
            <p className="text-sm text-[#8b949e] mt-1">Manage your account information</p>
          </div>
          <div className="px-6 py-4 flex flex-col gap-4">
            <div>
              <label className="text-xs text-[#8b949e] uppercase tracking-wide">Name</label>
              <p className="text-white mt-1">{user?.name ?? '—'}</p>
            </div>
            <div>
              <label className="text-xs text-[#8b949e] uppercase tracking-wide">Email</label>
              <p className="text-white mt-1">{user?.email ?? '—'}</p>
            </div>
          </div>
        </div>

        {/* Password Section */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-lg mb-4">
          <div className="px-6 py-4 border-b border-[#30363d]">
            <h2 className="text-base font-semibold text-white">Password</h2>
            <p className="text-sm text-[#8b949e] mt-1">Update your password to keep your account secure</p>
          </div>
          <div className="px-6 py-4">
            <a href="/reset-password" className="text-sm text-[#2f81f4] hover:underline">
              Change password →
            </a>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-[#161b22] border border-[#f85149]/40 rounded-lg">
          <div className="px-6 py-4 border-b border-[#f85149]/40">
            <h2 className="text-base font-semibold text-[#f85149]">Danger Zone</h2>
            <p className="text-sm text-[#8b949e] mt-1">Irreversible actions for your account</p>
          </div>
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-white font-medium">Sign out</p>
              <p className="text-xs text-[#8b949e] mt-0.5">End your current session</p>
            </div>
            {showConfirm ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-[#8b949e]">Are you sure?</p>
                <button
                  onClick={logout}
                  className="text-sm px-4 py-2 bg-[#f85149] text-white rounded hover:bg-red-600 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="text-sm px-4 py-2 border border-[#30363d] text-[#8b949e] rounded hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowConfirm(true)}
                className="text-sm px-4 py-2 border border-[#f85149]/60 text-[#f85149] rounded hover:bg-[#f85149]/10 transition-colors"
              >
                Sign out
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}