 import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}));

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  use: jest.fn(() => ({ id: '1' })),
}));

jest.mock('@/components/forms/job-modal', () => ({
  JobModal: ({ open }: { open: boolean }) => open ? <div data-testid="job-modal">Modal</div> : null,
}));

import JobDetailPage from '../../../app/(dashboard)/jobs/[id]/page';

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' };

const mockJob = {
  id: '1',
  title: 'Frontend Developer',
  company: 'Acme Corp',
  jobPostingBody: 'We are looking for a React expert',
  stage: 'Applied',
  deadline: null,
  recruiterNotes: null,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
};

const renderJobDetail = () => {
  return render(
    <AuthContext.Provider value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: jest.fn(), setUser: jest.fn() }}>
      <JobDetailPage params={Promise.resolve({ id: '1' })} />
    </AuthContext.Provider>
  );
};

describe('S2-015 - Job Delete Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.apiFetch as jest.Mock).mockImplementation((url: string) => {
      if (url === '/api/jobs/1') return Promise.resolve({ success: true, data: mockJob });
      if (url === '/api/jobs/1/interviews') return Promise.resolve({ success: true, data: [] });
      if (url === '/api/jobs/1/followups') return Promise.resolve({ success: true, data: [] });
      return Promise.resolve({ success: true, data: [] });
    });
  });

  it('renders delete button on job detail page', async () => {
    renderJobDetail();
    expect(await screen.findByText('Delete')).toBeInTheDocument();
  });

  it('shows confirmation dialog when delete is clicked', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderJobDetail();
    await screen.findByText('Delete');
    fireEvent.click(screen.getByText('Delete'));
    expect(confirmSpy).toHaveBeenCalledWith('Delete this job? This cannot be undone.');
    confirmSpy.mockRestore();
  });

  it('does not delete when user cancels confirmation', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    renderJobDetail();
    await screen.findByText('Delete');
    fireEvent.click(screen.getByText('Delete'));
    expect(api.apiFetch).not.toHaveBeenCalledWith('/api/jobs/1', { method: 'DELETE' });
  });

  it('calls delete API when user confirms', async () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    (api.apiFetch as jest.Mock).mockImplementation((url: string, options?: { method?: string }) => {
      if (url === '/api/jobs/1' && options?.method === 'DELETE') return Promise.resolve({ success: true });
      if (url === '/api/jobs/1') return Promise.resolve({ success: true, data: mockJob });
      if (url === '/api/jobs/1/interviews') return Promise.resolve({ success: true, data: [] });
      if (url === '/api/jobs/1/followups') return Promise.resolve({ success: true, data: [] });
      return Promise.resolve({ success: true, data: [] });
    });
    renderJobDetail();
    await screen.findByText('Delete');
    fireEvent.click(screen.getByText('Delete'));
    await waitFor(() => {
      expect(api.apiFetch).toHaveBeenCalledWith('/api/jobs/1', { method: 'DELETE' });
    });
  });

  it('asks for confirmation before replacing an existing saved resume', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    (api.apiFetch as jest.Mock).mockImplementation((url: string, options?: { method?: string }) => {
      if (url === '/api/jobs/1') return Promise.resolve({ success: true, data: mockJob });
      if (url === '/api/documents?jobId=1') {
        return Promise.resolve({
          success: true,
          data: [{
            id: 'resume-1',
            type: 'resume',
            title: 'Resume',
            content: 'Existing resume',
            versionNumber: 1,
            updatedAt: '2024-01-02T00:00:00Z',
          }],
        });
      }
      if (url === '/api/ai/generate-resume' && options?.method === 'POST') {
        return Promise.resolve({ success: true, data: { draft: 'New resume draft' } });
      }
      return Promise.resolve({ success: true, data: [] });
    });

    renderJobDetail();
    fireEvent.click(await screen.findByRole('button', { name: 'Generate Resume with AI' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Save Resume' }));

    expect(confirmSpy).toHaveBeenCalledWith(
      'You already have a saved resume for this job. Saving will replace it with this new version. Continue?'
    );
    expect(api.apiFetch).not.toHaveBeenCalledWith(
      '/api/documents',
      expect.objectContaining({ method: 'POST' })
    );
    confirmSpy.mockRestore();
  });
});
