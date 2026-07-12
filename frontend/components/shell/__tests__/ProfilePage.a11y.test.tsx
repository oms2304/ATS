import '@testing-library/jest-dom'
import { render, waitFor } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import ProfilePage from '../../../app/(dashboard)/profile/page'
import { AuthContext } from '@/context/AuthContext'
import { apiFetch } from '@/lib/api'

expect.extend(toHaveNoViolations)

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }))
const mockedFetch = apiFetch as jest.Mock

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' }

const renderProfile = () =>
  render(
    <AuthContext.Provider
      value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: jest.fn(), setUser: jest.fn() }}
    >
      <ProfilePage />
    </AuthContext.Provider>
  )

function mockGets() {
  mockedFetch.mockImplementation((path: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET'
    if (method === 'GET') {
      if (path === '/api/profile') {
        return Promise.resolve({ success: true, data: { firstName: '', lastName: '' } })
      }
      return Promise.resolve({ success: true, data: [] })
    }
    return Promise.resolve({ success: true, data: {} })
  })
}

beforeEach(() => {
  mockedFetch.mockReset()
  mockGets()
})

describe('ProfilePage - S3-019 Accessibility', () => {
  it('has no detectable accessibility violations', async () => {
    const { container } = renderProfile()
    await waitFor(() => expect(mockedFetch).toHaveBeenCalled())
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
