import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
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
  {
    id: '1',
    title: 'Frontend Developer',
    company: 'Acme Corp',
    jobPostingBody: 'Job description here',
    stage: 'Applied',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: '2',
    title: 'Backend Engineer',
    company: 'Tech Inc',
    jobPostingBody: 'Another description',
    stage: 'Interview',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z',
  },
];

const renderWithAuth = () => {
  return render(
    <AuthContext.Provider value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: jest.fn() }}>
      <DashboardPage />
    </AuthContext.Provider>
  );
};

describe('DashboardPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard search input', async () => {
  (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
  renderWithAuth();
  expect(await screen.findByPlaceholderText('Search jobs...')).toBeInTheDocument();
});

  // HAPPY PATH: shows job cards after loading
  it('displays job cards after data loads', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    renderWithAuth();
    expect(await screen.findByText('Frontend Developer')).toBeInTheDocument();
    expect(await screen.findByText('Backend Engineer')).toBeInTheDocument();
  });

  // HAPPY PATH: shows empty state when no jobs
  it('shows empty state when no jobs exist', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: [] });
    renderWithAuth();
    expect(await screen.findByText('No jobs yet')).toBeInTheDocument();
  });

  // HAPPY PATH: opens modal when Add Job is clicked
  it('opens job modal when Add Job button is clicked', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    renderWithAuth();
    await screen.findByPlaceholderText('Search jobs...');  
    fireEvent.click(screen.getByText('Add Job'));
    expect(screen.getByTestId('job-modal')).toBeInTheDocument();
  });

  // HAPPY PATH: search filters jobs
  it('filters jobs by search term', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    renderWithAuth();
    await screen.findByText('Frontend Developer');
    fireEvent.change(screen.getByPlaceholderText('Search jobs...'), {
      target: { value: 'Frontend' },
    });
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
    expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument();
  });

  // NON-HAPPY PATH: shows no match message when filter finds nothing
  it('shows no match message when filter finds no jobs', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    renderWithAuth();
    await screen.findByText('Frontend Developer');
    fireEvent.change(screen.getByPlaceholderText('Search jobs...'), {
      target: { value: 'zzznomatch' },
    });
    expect(screen.getByText('No jobs match your filters')).toBeInTheDocument();
  });
});