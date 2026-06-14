import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../../../app/(dashboard)/layout';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => '/dashboard'),
}));

jest.mock('@/components/shell/AppShell', () => {
  const MockAppShell = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
  MockAppShell.displayName = 'MockAppShell';
  return MockAppShell;
});

describe('DashboardLayout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders children when token exists', () => {
    localStorage.setItem('token', 'test-token');
    render(
      <DashboardLayout><p>Protected Content</p></DashboardLayout>
    );
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to /login when no token exists', () => {
    const mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    render(
      <DashboardLayout><p>Protected Content</p></DashboardLayout>
    );
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('renders children inside layout wrapper', () => {
    localStorage.setItem('token', 'test-token');
    render(
      <DashboardLayout><p>Test Child</p></DashboardLayout>
    );
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });
});