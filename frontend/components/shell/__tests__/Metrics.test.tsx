import '@testing-library/jest-dom';
import { render, screen, waitFor, within } from '@testing-library/react';
import DashboardPage from '../../../app/(dashboard)/dashboard/page';
import { AuthContext } from '@/context/AuthContext';

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

const mockApiFetch = jest.fn();
const mockArchiveJob = jest.fn((id: string) => mockApiFetch(`/api/jobs/${id}/archive`, { method: 'PATCH' }));
const mockRestoreJob = jest.fn((id: string) => mockApiFetch(`/api/jobs/${id}/restore`, { method: 'PATCH' }));
const mockUpdateJobStage = jest.fn((id: string, stage: string) => mockApiFetch(`/api/jobs/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }));

jest.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  archiveJob: (id: string) => mockArchiveJob(id),
  restoreJob: (id: string) => mockRestoreJob(id),
  updateJobStage: (id: string, stage: string) => mockUpdateJobStage(id, stage),
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
  velocity: 4,
  stageConversionRate: 30,
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
    mockApiFetch.mockImplementation((url: string) => {
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

  // S3-014: Velocity and Stage Conversion metric cards
  it('renders velocity and stage conversion metric cards with correct labels', async () => {
    renderWithAuth();
    expect(await screen.findByTestId('metrics-section')).toBeInTheDocument();
    expect(await screen.findByText('Velocity (7d)')).toBeInTheDocument();
    expect(await screen.findByText('Interview Rate (14d)')).toBeInTheDocument();
  });

  it('displays correct velocity and stage conversion values', async () => {
    renderWithAuth();
    expect(await screen.findByTestId('metric-velocity')).toHaveTextContent('4');
    expect(await screen.findByTestId('metric-stage-conversion')).toHaveTextContent('30%');
  });

  // NON-HAPPY PATH: metrics not shown when API fails
  it('does not show metrics when API returns no data', async () => {
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/api/jobs') return Promise.resolve({ success: true, data: mockJobs });
      if (url === '/api/metrics') return Promise.resolve({ success: false });
      return Promise.resolve({ success: true, data: [] });
    });
    renderWithAuth();
    await screen.findByPlaceholderText('Search jobs...');
    expect(screen.queryByText('Total Jobs')).not.toBeInTheDocument();
  });

  // REGRESSION: dashboard stats must refresh after a mutation (archive).
  it('refetches /api/metrics when a job is archived so the stats stay current', async () => {
    let metricsCallCount = 0;
    mockApiFetch.mockImplementation((url: string) => {
      if (url === '/api/metrics') {
        metricsCallCount += 1;
        // 1st call: totalJobs=2; every subsequent call: totalJobs=1 (decremented once after archive)
        return Promise.resolve({ success: true, data: { ...mockMetrics, totalJobs: metricsCallCount === 1 ? 2 : 1 } });
      }
      if (url === '/api/jobs') return Promise.resolve({ success: true, data: mockJobs });
      if (url.includes('/archive')) return Promise.resolve({ success: true, data: { id: '1' } });
      return Promise.resolve({ success: true, data: [] });
    });

    renderWithAuth();
    // Wait for the initial fetch + first paint of the metrics card.
    expect(await screen.findByTestId('metric-total-jobs')).toHaveTextContent('2');

    // The first card's Archive button is the only "Archive" button scoped to that card.
    const cards = await screen.findAllByTestId('job-card');
    expect(cards.length).toBeGreaterThan(0);
    const archiveButtons = within(cards[0]).getAllByRole('button', { name: /^archive$/i });
    expect(archiveButtons.length).toBe(1);
    archiveButtons[0].click();

    // First confirm the refetch actually fired (proves fetchMetrics is wired).
    await waitFor(() => {
      expect(metricsCallCount).toBeGreaterThanOrEqual(2);
    });
    // Then confirm the metrics card now reflects the freshest mock data.
    await waitFor(() => {
      expect(screen.getByTestId('metric-total-jobs')).toHaveTextContent('1');
    });
  });
});