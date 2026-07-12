import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import DashboardPage from '../../../app/(dashboard)/dashboard/page';
import { AuthContext } from '@/context/AuthContext';
import * as api from '@/lib/api';

expect.extend(toHaveNoViolations);

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
}));

jest.mock('next/link', () => {
  const MockLink = (props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => {
    const { href, children, ...rest } = props;
    return <a href={href} {...rest}>{children}</a>;
  };
  MockLink.displayName = 'MockLink';
  return MockLink;
});

jest.mock('@/components/forms/job-modal', () => ({
  JobModal: ({ open }: { open: boolean }) => (open ? <div data-testid="job-modal">Modal</div> : null),
}));

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}));

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' };

const mockJobs = [
  {
    id: '1',
    title: 'Frontend Developer',
    company: 'Acme Corp',
    jobPostingBody: 'We are looking for a React expert',
    stage: 'Applied',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
];

const renderWithAuth = () =>
  render(
    <AuthContext.Provider
      value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: jest.fn(), setUser: jest.fn() }}
    >
      <DashboardPage />
    </AuthContext.Provider>
  );

describe('DashboardPage - S3-019 Accessibility', () => {
  it('has no detectable accessibility violations (populated state)', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    const { container, findByText } = renderWithAuth();
    await findByText('Frontend Developer');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no detectable accessibility violations (empty state)', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: [] });
    const { container, findByText } = renderWithAuth();
    await findByText(/No jobs yet/i);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
