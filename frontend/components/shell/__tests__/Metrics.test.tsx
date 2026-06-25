import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import DashboardPage from '../../../app/(dashboard)/dashboard/page';
import { AuthContext } from '@/context/AuthContext';
import * as api from '@/lib/api';

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
  JobModal: ({ open }: { open: boolean }) => open ? <div data-testid="job-modal">Modal</div> : null,
}));

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}));

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' };

const mockJobs = [
  { id: '1', title: 'Frontend Developer', company: 'Acme Corp', jobPostingBody: 'React expert', stage: 'Applied', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-02T00:00:00Z' },
  { id: '2', title: 'Backend Engineer', company: 'Tech Inc', jobPostingBody: 'Node developer', stage: 'Interview', createdAt: '2024-01-03T00:00:00Z', updatedAt: '2024-01-04T00:00:00Z' },
];

const mockMetrics = {
  stageCounts: { Interested: 0, Applied: 1, Interview: 1, Offer: 0, Rejected: 0, Archived: 0 },
  totalJobs: 2,
  totalApplied: 2,
  totalResponded: 1,
  responseRate: 50,
};

const renderWithAuth = () => {
  return render(
    <AuthContext.Provider value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: jest.fn(), setUser: jest.fn() }}>
      <DashboardPage />
    </AuthContext.Provider>
  );
};

describe('S2-025 - Dashboard Metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.apiFetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/jobs') return Promise.resolve({ success: true, data: mockJobs });
      if (url === '/api/metrics') return Promise.resolve({ success: true, data: mockMetrics });
      return Promise.resolve({ success: true, data: [] });
    });
  });

    it('renders metrics section with correct values', async () => {
    renderWithAuth();
    expect(await screen.findByTestId('metrics-section')).toBeInTheDocument();
    expect(await screen.findByText('Total Jobs')).toBeInTheDocument();
    expect(await screen.findByText('Responses')).toBeInTheDocument();
    expect(await screen.findByText('Response Rate')).toBeInTheDocument();
    });

    it('displays correct metric values', async () => {
    renderWithAuth();
    expect(await screen.findByTestId('metric-total-jobs')).toHaveTextContent('2');
    expect(await screen.findByTestId('metric-response-rate')).toHaveTextContent('50%');
    });

  // NON-HAPPY PATH: metrics not shown when API fails
  it('does not show metrics when API returns no data', async () => {
    (api.apiFetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/jobs') return Promise.resolve({ success: true, data: mockJobs });
      if (url === '/api/metrics') return Promise.resolve({ success: false });
      return Promise.resolve({ success: true, data: [] });
    });
    renderWithAuth();
    await screen.findByPlaceholderText('Search jobs...');
    expect(screen.queryByText('Total Jobs')).not.toBeInTheDocument();
  });
});