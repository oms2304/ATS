import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import UserMenu from '../UserMenu';
import { AuthContext } from '@/context/AuthContext';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' };
const mockLogout = jest.fn();

const renderUserMenu = () => {
  return render(
    <AuthContext.Provider value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: mockLogout }}>
      <UserMenu user={mockUser} />
    </AuthContext.Provider>
  );
};

describe('Logout and Session Invalidation', () => {
  beforeEach(() => {
    mockLogout.mockClear();
    localStorage.clear();
  });

  it('renders user avatar button', () => {
    renderUserMenu();
    expect(screen.getByLabelText('User menu')).toBeInTheDocument();
  });

  it('opens dropdown when avatar is clicked', () => {
    renderUserMenu();
    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.getByText('Sign out')).toBeInTheDocument();
  });

  it('calls logout when sign out is clicked', () => {
    renderUserMenu();
    fireEvent.click(screen.getByLabelText('User menu'));
    fireEvent.click(screen.getByText('Sign out'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('redirects to /login after logout', () => {
    const mockPush = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
    renderUserMenu();
    fireEvent.click(screen.getByLabelText('User menu'));
    fireEvent.click(screen.getByText('Sign out'));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('clears auth token from localStorage on logout', () => {
    localStorage.setItem('auth_token', 'test-token');
    localStorage.setItem('auth_user', JSON.stringify(mockUser));
    mockLogout.mockImplementation(() => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    });
    renderUserMenu();
    fireEvent.click(screen.getByLabelText('User menu'));
    fireEvent.click(screen.getByText('Sign out'));
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('auth_user')).toBeNull();
  });
});