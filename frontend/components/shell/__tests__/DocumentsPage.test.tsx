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
  duplicateDocument: jest.fn(),
  renameDocument: jest.fn(),
}));

function getCardByTitle(title: string) {
  const titleEl = screen.getByText(title);
  return titleEl.closest('[data-testid="document-card"]') as HTMLElement;
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

  it('renders document cards after fetch resolves', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    render(<DocumentsPage />);
    expect(await screen.findByText('Alice Anderson Resume')).toBeInTheDocument();
    expect(screen.getByText('Cover Letter — City Hospital')).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    (api.apiFetch as jest.Mock).mockReturnValue(new Promise(() => {}));
    render(<DocumentsPage />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('opens modal with document content when View is clicked', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    render(<DocumentsPage />);
    await screen.findByText('Alice Anderson Resume');
    fireEvent.click(within(getCardByTitle('Alice Anderson Resume')).getByTestId('document-view-button'));
    expect(await screen.findByText('Resume content here')).toBeInTheDocument();
  });

  it('shows linked job info in modal description when present', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    render(<DocumentsPage />);
    await screen.findByText('Cover Letter — City Hospital');
    fireEvent.click(within(getCardByTitle('Cover Letter — City Hospital')).getByTestId('document-view-button'));
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => {
      expect(within(dialog).getByText(/Registered Nurse at City Hospital/)).toBeInTheDocument();
    });
  });

  it('shows empty state when there are no documents', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: [] });
    render(<DocumentsPage />);
    expect(await screen.findByText(/No saved documents yet/i)).toBeInTheDocument();
  });

  it('renders empty state gracefully when the API call fails', async () => {
    (api.apiFetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    render(<DocumentsPage />);
    expect(await screen.findByText(/No saved documents yet/i)).toBeInTheDocument();
  });
});

describe('DocumentsPage - S3-007 Document Duplicate and Rename', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // HAPPY PATH: duplicating prepends the new document to the list
  it('adds the duplicated document to the list when Duplicate succeeds', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    (api.duplicateDocument as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        id: 'doc-3',
        type: 'resume',
        title: 'Alice Anderson Resume (Copy)',
        content: 'Resume content here',
        versionNumber: 1,
        updatedAt: '2024-01-06T00:00:00Z',
        job: null,
      },
    });
    render(<DocumentsPage />);
    await screen.findByText('Alice Anderson Resume');

    fireEvent.click(within(getCardByTitle('Alice Anderson Resume')).getByTestId('document-duplicate-button'));

    expect(await screen.findByText('Alice Anderson Resume (Copy)')).toBeInTheDocument();
    expect(api.duplicateDocument).toHaveBeenCalledWith('doc-1');
  });

  // NON-HAPPY PATH: failed duplicate shows an inline error and does not add a card
  it('shows an error message and does not add a card when Duplicate fails', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    (api.duplicateDocument as jest.Mock).mockRejectedValue(new Error('Server error'));
    render(<DocumentsPage />);
    await screen.findByText('Alice Anderson Resume');

    fireEvent.click(within(getCardByTitle('Alice Anderson Resume')).getByTestId('document-duplicate-button'));

    expect(await screen.findByTestId('action-error')).toHaveTextContent(/could not duplicate/i);
    expect(screen.queryByText('Alice Anderson Resume (Copy)')).not.toBeInTheDocument();
  });

  // HAPPY PATH: renaming updates the title shown on the card
  it('updates the card title when Rename succeeds', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    (api.renameDocument as jest.Mock).mockResolvedValue({ success: true, data: {} });
    render(<DocumentsPage />);
    await screen.findByText('Alice Anderson Resume');

    const card = getCardByTitle('Alice Anderson Resume');
    fireEvent.click(within(card).getByTestId('document-rename-button'));
    fireEvent.change(within(card).getByTestId('document-rename-input'), {
      target: { value: 'Nurse Resume v2' },
    });
    fireEvent.click(within(card).getByTestId('document-rename-save'));

    expect(await screen.findByText('Nurse Resume v2')).toBeInTheDocument();
    expect(api.renameDocument).toHaveBeenCalledWith('doc-1', 'Nurse Resume v2');
  });

  // NON-HAPPY PATH: failed rename shows an inline error and keeps the original title
  it('shows an error message and keeps the original title when Rename fails', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    (api.renameDocument as jest.Mock).mockRejectedValue(new Error('Server error'));
    render(<DocumentsPage />);
    await screen.findByText('Alice Anderson Resume');

    const card = getCardByTitle('Alice Anderson Resume');
    fireEvent.click(within(card).getByTestId('document-rename-button'));
    fireEvent.change(within(card).getByTestId('document-rename-input'), {
      target: { value: 'Should Fail' },
    });
    fireEvent.click(within(card).getByTestId('document-rename-save'));

    expect(await screen.findByTestId('action-error')).toHaveTextContent(/could not rename/i);
    expect(screen.getByText('Alice Anderson Resume')).toBeInTheDocument();
  });
});
