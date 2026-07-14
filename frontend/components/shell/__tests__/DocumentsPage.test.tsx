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
  archiveDocument: jest.fn(),
  restoreDocument: jest.fn(),
  getDocumentVersions: jest.fn().mockResolvedValue({ success: true, data: [] }),
  uploadDocumentFile: jest.fn(),
}));

// Helper: find the card element for a given title, regardless of sort order in the grid.
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

  // NON-HAPPY PATH: type filter with no matches shows a message
  it('shows a no-match message when the type filter excludes all documents', async () => {
    const resumeOnlyDocs = filterDocs.filter((d) => d.type === 'resume');
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: resumeOnlyDocs });
    render(<DocumentsPage />);
    await screen.findByText('Active Resume');

    fireEvent.change(screen.getByTestId('type-filter'), { target: { value: 'cover_letter' } });

    expect(screen.getByTestId('no-match-message')).toBeInTheDocument();
  });
});

describe('DocumentsPage - S3-008 Document Archive and Restore', () => {
  const activeDocs = [
    {
      id: 'doc-1',
      type: 'resume',
      title: 'My Resume',
      content: 'Resume content',
      versionNumber: 1,
      updatedAt: '2024-01-01T00:00:00Z',
      archivedAt: null,
      job: null,
    },
  ];

  const archivedDocs = [
    {
      id: 'doc-2',
      type: 'cover_letter',
      title: 'Old Cover Letter',
      content: 'Cover letter content',
      versionNumber: 1,
      updatedAt: '2024-01-01T00:00:00Z',
      archivedAt: '2024-02-01T00:00:00Z',
      job: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // HAPPY PATH: archiving a document removes it from the active view
  it('removes a document from the active view when Archive succeeds', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: activeDocs });
    (api.archiveDocument as jest.Mock).mockResolvedValue({ success: true, data: {} });
    render(<DocumentsPage />);
    await screen.findByText('My Resume');

    fireEvent.click(within(getCardByTitle('My Resume')).getByTestId('document-archive-button'));

    await waitFor(() => {
      expect(screen.queryByText('My Resume')).not.toBeInTheDocument();
    });
    expect(api.archiveDocument).toHaveBeenCalledWith('doc-1');
  });

  // NON-HAPPY PATH: failed archive keeps the document visible with an error message
  it('shows an error message and keeps the document visible when Archive fails', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: activeDocs });
    (api.archiveDocument as jest.Mock).mockRejectedValue(new Error('Server error'));
    render(<DocumentsPage />);
    await screen.findByText('My Resume');

    fireEvent.click(within(getCardByTitle('My Resume')).getByTestId('document-archive-button'));

    expect(await screen.findByTestId('action-error')).toHaveTextContent(/could not archive/i);
    expect(screen.getByText('My Resume')).toBeInTheDocument();
  });

  // HAPPY PATH: toggling "Show archived" fetches the archived list and shows Restore
  it('fetches and displays archived documents with a Restore button when the toggle is clicked', async () => {
    (api.apiFetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('archived=true')) {
        return Promise.resolve({ success: true, data: archivedDocs });
      }
      return Promise.resolve({ success: true, data: activeDocs });
    });
    render(<DocumentsPage />);
    await screen.findByText('My Resume');

    fireEvent.click(screen.getByTestId('toggle-archived-documents'));

    expect(await screen.findByText('Old Cover Letter')).toBeInTheDocument();
    expect(screen.getByTestId('document-restore-button')).toBeInTheDocument();
    expect(api.apiFetch).toHaveBeenCalledWith(expect.stringContaining('archived=true'));
  });

  // HAPPY PATH: restoring a document removes it from the archived view
  it('removes a document from the archived view when Restore succeeds', async () => {
    (api.apiFetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('archived=true')) {
        return Promise.resolve({ success: true, data: archivedDocs });
      }
      return Promise.resolve({ success: true, data: activeDocs });
    });
    (api.restoreDocument as jest.Mock).mockResolvedValue({ success: true, data: {} });
    render(<DocumentsPage />);
    await screen.findByText('My Resume');
    fireEvent.click(screen.getByTestId('toggle-archived-documents'));
    await screen.findByText('Old Cover Letter');

    fireEvent.click(within(getCardByTitle('Old Cover Letter')).getByTestId('document-restore-button'));

    await waitFor(() => {
      expect(screen.queryByText('Old Cover Letter')).not.toBeInTheDocument();
    });
    expect(api.restoreDocument).toHaveBeenCalledWith('doc-2');
  });

  // NON-HAPPY PATH: failed restore keeps the document visible with an error message
  it('shows an error message and keeps the document visible when Restore fails', async () => {
    (api.apiFetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('archived=true')) {
        return Promise.resolve({ success: true, data: archivedDocs });
      }
      return Promise.resolve({ success: true, data: activeDocs });
    });
    (api.restoreDocument as jest.Mock).mockRejectedValue(new Error('Server error'));
    render(<DocumentsPage />);
    await screen.findByText('My Resume');
    fireEvent.click(screen.getByTestId('toggle-archived-documents'));
    await screen.findByText('Old Cover Letter');

    fireEvent.click(within(getCardByTitle('Old Cover Letter')).getByTestId('document-restore-button'));

    expect(await screen.findByTestId('action-error')).toHaveTextContent(/could not restore/i);
    expect(screen.getByText('Old Cover Letter')).toBeInTheDocument();
  });

  // NON-HAPPY PATH: empty archived view shows the correct empty-state message
  it('shows an archived-specific empty message when there are no archived documents', async () => {
    (api.apiFetch as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('archived=true')) {
        return Promise.resolve({ success: true, data: [] });
      }
      return Promise.resolve({ success: true, data: activeDocs });
    });
    render(<DocumentsPage />);
    await screen.findByText('My Resume');

    fireEvent.click(screen.getByTestId('toggle-archived-documents'));

    expect(await screen.findByText('No archived documents.')).toBeInTheDocument();
  });
});


describe('DocumentsPage - S3-004 Document Upload', () => {
  const mockFile = new File(['fake pdf content'], 'resume.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // HAPPY PATH: opening the upload modal shows the form
  it('opens the upload modal when Upload Document is clicked', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: [] });
    render(<DocumentsPage />);
    await screen.findByText(/No saved documents yet/i);

    fireEvent.click(screen.getByTestId('open-upload-modal'));

    expect(screen.getByTestId('upload-file-input')).toBeInTheDocument();
    expect(screen.getByTestId('upload-type-select')).toBeInTheDocument();
    expect(screen.getByTestId('upload-title-input')).toBeInTheDocument();
  });

  // NON-HAPPY PATH: submitting without a file shows a validation message
  it('shows an error when submitting without selecting a file', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: [] });
    render(<DocumentsPage />);
    await screen.findByText(/No saved documents yet/i);
    fireEvent.click(screen.getByTestId('open-upload-modal'));

    fireEvent.change(screen.getByTestId('upload-title-input'), { target: { value: 'My Resume' } });
    fireEvent.click(screen.getByTestId('upload-submit-button'));

    expect(await screen.findByTestId('upload-error')).toHaveTextContent(/choose a file/i);
    expect(api.uploadDocumentFile).not.toHaveBeenCalled();
  });

  // NON-HAPPY PATH: submitting without a title shows a validation message
  it('shows an error when submitting without a title', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: [] });
    render(<DocumentsPage />);
    await screen.findByText(/No saved documents yet/i);
    fireEvent.click(screen.getByTestId('open-upload-modal'));

    const fileInput = screen.getByTestId('upload-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.click(screen.getByTestId('upload-submit-button'));

    expect(await screen.findByTestId('upload-error')).toHaveTextContent(/enter a title/i);
    expect(api.uploadDocumentFile).not.toHaveBeenCalled();
  });

  // HAPPY PATH: successful upload closes the modal and refreshes the list
  it('uploads a file, closes the modal, and refreshes the document list on success', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValueOnce({ success: true, data: [] });
    (api.uploadDocumentFile as jest.Mock).mockResolvedValue({ success: true, data: {} });
    (api.apiFetch as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'doc-1',
          type: 'resume',
          title: 'My Resume',
          content: null,
          fileUrl: 'https://storage.example.com/resume.pdf',
          fileName: 'resume.pdf',
          mimeType: 'application/pdf',
          versionNumber: 1,
          updatedAt: '2024-01-01T00:00:00Z',
          job: null,
        },
      ],
    });

    render(<DocumentsPage />);
    await screen.findByText(/No saved documents yet/i);
    fireEvent.click(screen.getByTestId('open-upload-modal'));

    const fileInput = screen.getByTestId('upload-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.change(screen.getByTestId('upload-title-input'), { target: { value: 'My Resume' } });
    fireEvent.click(screen.getByTestId('upload-submit-button'));

    await waitFor(() => {
      expect(api.uploadDocumentFile).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('upload-file-input')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('My Resume')).toBeInTheDocument();
  });

  // NON-HAPPY PATH: failed upload keeps the modal open and shows the server's error
  it('shows the server error and keeps the modal open when upload fails', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: [] });
    const uploadError = Object.assign(new Error('Validation failed'), {
      data: { fields: { file: ['Only PDF, DOCX, and TXT files are supported'] } },
    });
    (api.uploadDocumentFile as jest.Mock).mockRejectedValue(uploadError);

    render(<DocumentsPage />);
    await screen.findByText(/No saved documents yet/i);
    fireEvent.click(screen.getByTestId('open-upload-modal'));

    const fileInput = screen.getByTestId('upload-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    fireEvent.change(screen.getByTestId('upload-title-input'), { target: { value: 'My Resume' } });
    fireEvent.click(screen.getByTestId('upload-submit-button'));

    expect(await screen.findByTestId('upload-error')).toHaveTextContent(/Only PDF, DOCX, and TXT/i);
    expect(screen.getByTestId('upload-file-input')).toBeInTheDocument();
  });

  // HAPPY PATH: an uploaded (file-based) document shows a download link, not the content pane
  it('shows a file download link instead of a content pane when viewing an uploaded document', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          id: 'doc-1',
          type: 'resume',
          title: 'Uploaded Resume',
          content: null,
          fileUrl: 'https://storage.example.com/resume.pdf',
          fileName: 'resume.pdf',
          mimeType: 'application/pdf',
          fileSize: 20480,
          versionNumber: 1,
          updatedAt: '2024-01-01T00:00:00Z',
          job: null,
        },
      ],
    });

    render(<DocumentsPage />);
    await screen.findByText('Uploaded Resume');
    fireEvent.click(within(getCardByTitle('Uploaded Resume')).getByTestId('document-view-button'));

    const fileInfo = await screen.findByTestId('document-file-info');
    expect(within(fileInfo).getByText('resume.pdf')).toBeInTheDocument();
    const downloadLink = screen.getByTestId('document-file-download-link');
    expect(downloadLink).toHaveAttribute('href', 'https://storage.example.com/resume.pdf');
  });
});
