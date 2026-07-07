import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import DocumentsPage from '../../../app/(dashboard)/documents/page';
import * as api from '@/lib/api';

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

const mockDocs = [
  {
    id: 'doc-1',
    type: 'resume',
    title: 'Alice Anderson Resume',
    content: 'Resume content here',
    versionNumber: 1,
    updatedAt: '2024-01-02T00:00:00Z',
    job: null,
  },
  {
    id: 'doc-2',
    type: 'cover_letter',
    title: 'Cover Letter — City Hospital',
    content: 'Cover letter content here',
    versionNumber: 2,
    updatedAt: '2024-01-03T00:00:00Z',
    job: { id: 'job-1', title: 'Registered Nurse', company: 'City Hospital' },
  },
];

describe('DocumentsPage - S3-001 Document Library List View', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // HAPPY PATH: renders documents fetched from the API
  it('renders document cards after fetch resolves', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    render(<DocumentsPage />);
    expect(await screen.findByText('Alice Anderson Resume')).toBeInTheDocument();
    expect(screen.getByText('Cover Letter — City Hospital')).toBeInTheDocument();
  });

  // HAPPY PATH: shows loading state before fetch resolves
  it('shows loading state initially', () => {
    (api.apiFetch as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves
    render(<DocumentsPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  // HAPPY PATH: clicking View opens the modal with full content
  it('opens modal with document content when View is clicked', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    render(<DocumentsPage />);
    await screen.findByText('Alice Anderson Resume');
    const viewButtons = screen.getAllByTestId('document-view-button');
    fireEvent.click(viewButtons[0]);
    expect(await screen.findByText('Resume content here')).toBeInTheDocument();
  });

  // HAPPY PATH: modal shows linked job info when present
  it('shows linked job info in modal description when present', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    render(<DocumentsPage />);
    await screen.findByText('Cover Letter — City Hospital');
    const viewButtons = screen.getAllByTestId('document-view-button');
    fireEvent.click(viewButtons[1]);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(within(dialog).getByText(/Registered Nurse at City Hospital/)).toBeInTheDocument();
    });
  });

  // NON-HAPPY PATH: empty document list shows empty state message
  it('shows empty state when there are no documents', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: [] });
    render(<DocumentsPage />);
    expect(
      await screen.findByText(/No saved documents yet/i)
    ).toBeInTheDocument();
  });

  // NON-HAPPY PATH: failed fetch still renders page without crashing
  it('renders empty state gracefully when the API call fails', async () => {
    (api.apiFetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    render(<DocumentsPage />);
    expect(
      await screen.findByText(/No saved documents yet/i)
    ).toBeInTheDocument();
  });
});
