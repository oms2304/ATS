import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import SettingsPage from '../../../app/(dashboard)/settings/page';
import { AuthContext } from '@/context/AuthContext';

expect.extend(toHaveNoViolations);

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
}));

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' };

const renderWithAuth = () =>
  render(
    <AuthContext.Provider
      value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: jest.fn(), setUser: jest.fn() }}
    >
      <SettingsPage />
    </AuthContext.Provider>
  );

describe('SettingsPage - S3-019 Accessibility', () => {
  it('has no detectable accessibility violations', async () => {
    const { container } = renderWithAuth();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
