import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../app/(dashboard)/layout';
import { AuthContext } from '@/context/AuthContext';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => '/dashboard'),
}));

jest.mock('@/components/shell/AppShell', () => {
  const MockAppShell = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  MockAppShell.displayName = 'MockAppShell';
  return MockAppShell;
});

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' };

type MockUser = { userId: string; name: string; email: string };

const renderWithAuth = (user: MockUser | null) => {
  return render(
    <AuthContext.Provider value={{ user, isLoading: false, login: jest.fn(), logout: jest.fn(), setUser: jest.fn() }}>
      <DashboardLayout><p>Protected Content</p></DashboardLayout>
    </AuthContext.Provider>
  );
};

describe('DashboardLayout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders children when authenticated', () => {
    renderWithAuth(mockUser);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn(), replace: mockReplace });
    renderWithAuth(null);
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('renders children inside layout wrapper', () => {
    renderWithAuth(mockUser);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
