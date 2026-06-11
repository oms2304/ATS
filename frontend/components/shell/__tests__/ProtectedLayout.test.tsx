import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../app/(dashboard)/layout';
import { AuthContext } from '@/context/AuthContext';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ replace: jest.fn() })),
}));

jest.mock('../AppShell', () => {
  const MockAppShell = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  MockAppShell.displayName = 'MockAppShell';
  return MockAppShell;
});

const mockUser = { userId: '1', name: 'Jane', email: 'jane@example.com' };

describe('DashboardLayout', () => {
  it('renders children when user is authenticated', () => {
    render(
      <AuthContext.Provider value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: jest.fn() }}>
        <DashboardLayout><p>Protected Content</p></DashboardLayout>
      </AuthContext.Provider>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when user is not authenticated', () => {
    const mockReplace = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ replace: mockReplace });

    render(
      <AuthContext.Provider value={{ user: null, isLoading: false, login: jest.fn(), logout: jest.fn() }}>
        <DashboardLayout><p>Protected Content</p></DashboardLayout>
      </AuthContext.Provider>
    );

    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('shows loading indicator while auth state is resolving', () => {
    render(
      <AuthContext.Provider value={{ user: null, isLoading: true, login: jest.fn(), logout: jest.fn() }}>
        <DashboardLayout><p>Protected Content</p></DashboardLayout>
      </AuthContext.Provider>
    );
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});