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

// Helper: find the View button that belongs to the card with the given title,
// regardless of sort order in the grid.
function getViewButtonForTitle(title: string) {
  const titleEl = screen.getByText(title);
  const card = titleEl.closest('[data-testid="document-card"]') as HTMLElement;
  return within(card).getByTestId('document-view-button');
}

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
    fireEvent.click(getViewButtonForTitle('Alice Anderson Resume'));
    expect(await screen.findByText('Resume content here')).toBeInTheDocument();
  });

  // HAPPY PATH: modal shows linked job info when present
  it('shows linked job info in modal description when present', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    render(<DocumentsPage />);
    await screen.findByText('Cover Letter — City Hospital');
    fireEvent.click(getViewButtonForTitle('Cover Letter — City Hospital'));
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

describe('DocumentsPage - S3-006 Library Filtering and Sorting', () => {
  const filterDocs = [
    {
      id: 'doc-1',
      type: 'resume',
      title: 'Active Resume',
      content: 'content A',
      versionNumber: 1,
      updatedAt: '2024-01-01T00:00:00Z',
      status: 'active',
      tags: [],
      job: null,
    },
    {
      id: 'doc-2',
      type: 'cover_letter',
      title: 'Archived Cover Letter',
      content: 'content B',
      versionNumber: 1,
      updatedAt: '2024-01-05T00:00:00Z',
      status: 'archived',
      tags: [],
      job: null,
    },
    {
      id: 'doc-3',
      type: 'resume',
      title: 'Zebra Resume',
      content: 'content C',
      versionNumber: 1,
      updatedAt: '2024-01-03T00:00:00Z',
      status: 'active',
      tags: ['urgent'],
      job: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // HAPPY PATH: type filter narrows the visible cards
  it('filters documents by type', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: filterDocs });
    render(<DocumentsPage />);
    await screen.findByText('Active Resume');

    fireEvent.change(screen.getByTestId('type-filter'), { target: { value: 'cover_letter' } });

    expect(screen.getByText('Archived Cover Letter')).toBeInTheDocument();
    expect(screen.queryByText('Active Resume')).not.toBeInTheDocument();
    expect(screen.queryByText('Zebra Resume')).not.toBeInTheDocument();
  });

  // HAPPY PATH: status filter narrows the visible cards
  it('filters documents by status', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: filterDocs });
    render(<DocumentsPage />);
    await screen.findByText('Active Resume');

    fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'archived' } });

    expect(screen.getByText('Archived Cover Letter')).toBeInTheDocument();
    expect(screen.queryByText('Active Resume')).not.toBeInTheDocument();
    expect(screen.queryByText('Zebra Resume')).not.toBeInTheDocument();
  });

  // HAPPY PATH: combining type and status filters narrows further
  it('combines type and status filters', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: filterDocs });
    render(<DocumentsPage />);
    await screen.findByText('Active Resume');

    fireEvent.change(screen.getByTestId('type-filter'), { target: { value: 'resume' } });
    fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'active' } });

    expect(screen.getByText('Active Resume')).toBeInTheDocument();
    expect(screen.getByText('Zebra Resume')).toBeInTheDocument();
    expect(screen.queryByText('Archived Cover Letter')).not.toBeInTheDocument();
  });

  // HAPPY PATH: sorting by title A-Z orders cards alphabetically
  it('sorts documents by title A-Z', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: filterDocs });
    render(<DocumentsPage />);
    await screen.findByText('Active Resume');

    fireEvent.change(screen.getByTestId('sort-select'), { target: { value: 'titleAsc' } });

    const titles = screen.getAllByTestId('document-title');
    expect(titles[0]).toHaveTextContent('Active Resume');
    expect(titles[1]).toHaveTextContent('Archived Cover Letter');
    expect(titles[2]).toHaveTextContent('Zebra Resume');
  });

  // HAPPY PATH: default sort is last updated, newest first
  it('sorts documents by last updated (newest first) by default', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: filterDocs });
    render(<DocumentsPage />);
    await screen.findByText('Active Resume');

    const titles = screen.getAllByTestId('document-title');
    expect(titles[0]).toHaveTextContent('Archived Cover Letter'); // Jan 5
    expect(titles[1]).toHaveTextContent('Zebra Resume'); // Jan 3
    expect(titles[2]).toHaveTextContent('Active Resume'); // Jan 1
  });

  // NON-HAPPY PATH: filter combination with no matches shows a message
  it('shows a no-match message when filters exclude all documents', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: filterDocs });
    render(<DocumentsPage />);
    await screen.findByText('Active Resume');

    fireEvent.change(screen.getByTestId('type-filter'), { target: { value: 'cover_letter' } });
    fireEvent.change(screen.getByTestId('status-filter'), { target: { value: 'active' } });

    expect(screen.getByTestId('no-match-message')).toBeInTheDocument();
  });
});
