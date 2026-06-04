'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [generalError, setGeneralError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setFieldErrors(prev => ({ ...prev, [e.target.name]: '' }))
  }

  function validate() {
    const errors: Record<string, string> = {}
    if (!form.name.trim()) errors.name = 'Name is required'
    if (!form.email.trim()) errors.email = 'Email is required'
    if (!form.password) errors.password = 'Password is required'
    if (form.password && form.password.length < 6)
      errors.password = 'Password must be at least 6 characters'
    if (form.password !== form.confirmPassword)
      errors.confirmPassword = 'Passwords do not match'
    return errors
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError('')

    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setLoading(true)
    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password
        })
      })

      if (!data.success) {
        if (data.fields) {
          setFieldErrors(data.fields)
        } else {
          setGeneralError(data.error ?? 'Registration failed')
        }
        return
      }

      localStorage.setItem('token', data.data.token)
      router.push('/dashboard')
    } catch {
      setGeneralError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputBase: React.CSSProperties = {
    width: '100%',
    backgroundColor: '#0d1117',
    borderRadius: '0.375rem',
    padding: '0.5rem 0.75rem',
    color: '#e6edf3',
    fontSize: '0.875rem',
    outline: 'none',
    boxSizing: 'border-box'
  }

  const fields: { key: keyof typeof form; label: string; type: string }[] = [
    { key: 'name', label: 'Name', type: 'text' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'password', label: 'Password', type: 'password' },
    { key: 'confirmPassword', label: 'Confirm Password', type: 'password' }
  ]

  return (
    <div
      style={{
        backgroundColor: '#0d1117',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '0.75rem',
          padding: '2rem',
          width: '100%',
          maxWidth: '420px'
        }}
      >
        <h1
          style={{
            color: '#e6edf3',
            fontSize: '1.5rem',
            fontWeight: 700,
            textAlign: 'center',
            marginBottom: '1.5rem'
          }}
        >
          ATS for Job Seekers
        </h1>

        {generalError && (
          <p
            style={{
              color: '#f85149',
              fontSize: '0.875rem',
              marginBottom: '1rem',
              textAlign: 'center'
            }}
          >
            {generalError}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
        >
          {fields.map(({ key, label, type }) => (
            <div key={key}>
              <label
                style={{
                  display: 'block',
                  color: '#e6edf3',
                  fontSize: '0.875rem',
                  marginBottom: '0.375rem'
                }}
              >
                {label}
              </label>
              <input
                name={key}
                type={type}
                value={form[key]}
                onChange={handleChange}
                style={{
                  ...inputBase,
                  border: `1px solid ${fieldErrors[key] ? '#f85149' : '#30363d'}`
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#2f81f4')}
                onBlur={e =>
                  (e.currentTarget.style.borderColor = fieldErrors[key]
                    ? '#f85149'
                    : '#30363d')
                }
              />
              {fieldErrors[key] && (
                <p
                  style={{
                    color: '#f85149',
                    fontSize: '0.75rem',
                    marginTop: '0.25rem'
                  }}
                >
                  {fieldErrors[key]}
                </p>
              )}
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: '#2f81f4',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.375rem',
              padding: '0.625rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              width: '100%',
              marginTop: '0.5rem'
            }}
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p
          style={{
            color: '#8b949e',
            fontSize: '0.875rem',
            textAlign: 'center',
            marginTop: '1.25rem'
          }}
        >
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#2f81f4', textDecoration: 'none' }}>
            Login
          </Link>
        </p>
      </div>
    </div>
  )
}
