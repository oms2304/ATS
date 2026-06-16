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
  const MockLink = (props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => {
    const { href, children, ...rest } = props;
    return <a href={href} {...rest}>{children}</a>;
  };
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' };

type MockUser = { userId: string; name: string; email: string };

const renderWithAuth = (user: MockUser | null = mockUser, path = '/dashboard') => {
  (usePathname as jest.Mock).mockReturnValue(path);
  return render(
    <AuthContext.Provider value={{ user, isLoading: false, login: jest.fn(), logout: jest.fn(), setUser: jest.fn() }}>
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

  it('renders the brand text as "ATS for Job Seekers"', () => {
    renderWithAuth();
    expect(screen.getByText('ATS for Job Seekers')).toBeInTheDocument();
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
    renderWithAuth(null);
    expect(screen.queryByText('J')).not.toBeInTheDocument();
  });
});