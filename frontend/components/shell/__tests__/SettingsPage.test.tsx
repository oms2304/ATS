import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPage from '../../../app/(dashboard)/settings/page';
import { AuthContext } from '@/context/AuthContext';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
}));

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' };
const mockLogout = jest.fn();

const renderWithAuth = (user = mockUser) => {
  return render(
    <AuthContext.Provider value={{ user, isLoading: false, login: jest.fn(), logout: mockLogout }}>
      <SettingsPage />
    </AuthContext.Provider>
  );
};

describe('SettingsPage', () => {
  beforeEach(() => {
    mockLogout.mockClear();
  });

  it('renders settings page with correct sections', () => {
    renderWithAuth();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByText('Danger Zone')).toBeInTheDocument();
  });

  it('displays user name and email', () => {
    renderWithAuth();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('shows confirmation when sign out button is clicked', () => {
    renderWithAuth();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('calls logout when confirm is clicked', () => {
    renderWithAuth();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('hides confirmation when cancel is clicked', () => {
    renderWithAuth();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
  });

  it('shows dashes when user info is missing', () => {
    renderWithAuth(null as unknown as typeof mockUser);
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });
});