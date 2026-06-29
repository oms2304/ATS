import '@testing-library/jest-dom'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProfilePage from '../../../app/(dashboard)/profile/page'
import { AuthContext } from '@/context/AuthContext'
import { apiFetch } from '@/lib/api'

jest.mock('@/lib/api', () => ({ apiFetch: jest.fn() }))

const mockedFetch = apiFetch as jest.Mock

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' }

const renderProfile = () =>
  render(
    <AuthContext.Provider
      value={{
        user: mockUser,
        isLoading: false,
        login: jest.fn(),
        logout: jest.fn(),
        setUser: jest.fn(),
      }}
    >
      <ProfilePage />
    </AuthContext.Provider>
  )

// Default: every GET fired on mount resolves with an empty section so the page
// finishes loading. Individual tests override the POST behavior they care about.
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

// Build the kind of error apiFetch throws on a 400: an Error carrying the parsed
// response body on `.data`.
function validationError(fields: Record<string, string[]>) {
  return Object.assign(new Error('Validation failed'), {
    status: 400,
    data: { success: false, error: 'Validation failed', fields },
  })
}

beforeEach(() => {
  mockedFetch.mockReset()
  mockGets()
})

async function openSkillForm() {
  renderProfile()
  await screen.findByText('Skills')
  fireEvent.click(screen.getByRole('button', { name: 'Add Skill' }))
  fireEvent.change(screen.getByPlaceholderText('Enter skill name'), {
    target: { value: 'React' },
  })
}

describe('Profile section-level validation UX (S2-020)', () => {
  it('surfaces a server field-level error under the skill input on a duplicate (S2-BR-016/017)', async () => {
    await openSkillForm()

    mockedFetch.mockImplementationOnce(() =>
      Promise.reject(validationError({ name: ['You already have this skill'] }))
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Skill' }))

    expect(
      await screen.findByText('You already have this skill')
    ).toBeInTheDocument()
  })

  it('saves a valid skill independently and confirms success (happy path)', async () => {
    await openSkillForm()

    mockedFetch.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
        data: { id: 's1', name: 'React', category: null, proficiency: null, order: 0 },
      })
    )

    fireEvent.click(screen.getByRole('button', { name: 'Add Skill' }))

    await waitFor(() => expect(screen.getByText('Skill added')).toBeInTheDocument())
    expect(screen.getByText('React')).toBeInTheDocument()
  })
})
