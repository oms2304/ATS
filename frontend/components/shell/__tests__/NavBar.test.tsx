import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import NavBar from '../NavBar';
import { AuthContext } from '@/context/AuthContext';

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock('next/link', () => {
  return ({ href, children, className, 'aria-current': ariaCurrent }: any) => (
    <a href={href} className={className} aria-current={ariaCurrent}>
      {children}
    </a>
  );
});

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' };

const renderWithAuth = (user = mockUser, path = '/dashboard') => {
  (usePathname as jest.Mock).mockReturnValue(path);
  return render(
    <AuthContext.Provider value={{ user, isLoading: false, login: jest.fn(), logout: jest.fn() }}>
      <NavBar />
    </AuthContext.Provider>
  );
};

describe('NavBar', () => {
  it('renders Dashboard, Profile, and Settings links', () => {
    renderWithAuth();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('marks the current route link as active', () => {
    renderWithAuth(mockUser, '/profile');
    const profileLink = screen.getByText('Profile').closest('a');
    expect(profileLink).toHaveClass('nav-link--active');
  });

  it('does not mark non-current links as active', () => {
    renderWithAuth(mockUser, '/dashboard');
    const profileLink = screen.getByText('Profile').closest('a');
    expect(profileLink).not.toHaveClass('nav-link--active');
  });

  it('renders user avatar with first letter of name', () => {
    renderWithAuth();
    expect(screen.getByText('J')).toBeInTheDocument();
  });

  it('does not render user avatar when no user', () => {
    renderWithAuth(null as any);
    expect(screen.queryByText('J')).not.toBeInTheDocument();
  });
});