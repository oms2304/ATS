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
    jobPostingBody: 'We are looking for a React expert',
    stage: 'Applied',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: '2',
    title: 'Backend Engineer',
    company: 'Tech Inc',
    jobPostingBody: 'We need a Node.js developer',
    stage: 'Interview',
    createdAt: '2024-01-03T00:00:00Z',
    updatedAt: '2024-01-04T00:00:00Z',
  },
];

const renderWithAuth = () => {
  return render(
    <AuthContext.Provider value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: jest.fn(), setUser: jest.fn() }}>
      <DashboardPage />
    </AuthContext.Provider>
  );
};

describe('DashboardPage - S2-001 Job Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // HAPPY PATH: renders search input
  it('renders search input', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    renderWithAuth();
    expect(await screen.findByPlaceholderText('Search jobs...')).toBeInTheDocument();
  });

  // HAPPY PATH: search by title
  it('filters jobs by title', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    renderWithAuth();
    await screen.findByPlaceholderText('Search jobs...');
    fireEvent.change(screen.getByPlaceholderText('Search jobs...'), {
      target: { value: 'Frontend' },
    });
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
    expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument();
  });

  // HAPPY PATH: search by company
  it('filters jobs by company', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    renderWithAuth();
    await screen.findByPlaceholderText('Search jobs...');
    fireEvent.change(screen.getByPlaceholderText('Search jobs...'), {
      target: { value: 'Tech Inc' },
    });
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Frontend Developer')).not.toBeInTheDocument();
  });

  // HAPPY PATH: search by keyword in job posting body
  it('filters jobs by keyword in job posting body', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    renderWithAuth();
    await screen.findByPlaceholderText('Search jobs...');
    fireEvent.change(screen.getByPlaceholderText('Search jobs...'), {
      target: { value: 'React' },
    });
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
    expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument();
  });

  // NON-HAPPY PATH: no results found
  it('shows no match message when search finds nothing', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    renderWithAuth();
    await screen.findByPlaceholderText('Search jobs...');
    fireEvent.change(screen.getByPlaceholderText('Search jobs...'), {
      target: { value: 'zzznomatch' },
    });
    expect(screen.getByText('No jobs match your filters')).toBeInTheDocument();
  });

  // HAPPY PATH: empty search shows all jobs
  it('shows all jobs when search is cleared', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
    renderWithAuth();
    await screen.findByPlaceholderText('Search jobs...');
    fireEvent.change(screen.getByPlaceholderText('Search jobs...'), {
      target: { value: 'Frontend' },
    });
    fireEvent.change(screen.getByPlaceholderText('Search jobs...'), {
      target: { value: '' },
    });
    expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
    expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
  });

  // S2-002 Filter Tests
it('renders stage filter dropdown', async () => {
  (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
  renderWithAuth();
  expect(await screen.findByRole('combobox')).toBeInTheDocument();
});

it('filters jobs by stage', async () => {
  (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
  renderWithAuth();
  await screen.findByPlaceholderText('Search jobs...');
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: 'Applied' },
  });
  expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
  expect(screen.queryByText('Backend Engineer')).not.toBeInTheDocument();
});

it('shows all jobs when All stages selected', async () => {
  (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
  renderWithAuth();
  await screen.findByPlaceholderText('Search jobs...');
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: 'All' },
  });
  expect(screen.getByText('Frontend Developer')).toBeInTheDocument();
  expect(screen.getByText('Backend Engineer')).toBeInTheDocument();
});

it('shows no match when stage has no jobs', async () => {
  (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockJobs });
  renderWithAuth();
  await screen.findByPlaceholderText('Search jobs...');
  fireEvent.change(screen.getByRole('combobox'), {
    target: { value: 'Offer' },
  });
  expect(screen.getByText('No jobs match your filters')).toBeInTheDocument();
});
});