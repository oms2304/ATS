import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentCard } from '../../ui/document-card';

jest.mock('next/link', () => {
  const MockLink = (props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => {
    const { href, children, ...rest } = props;
    return <a href={href} {...rest}>{children}</a>;
  };
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const mockDoc = {
  id: 'doc-1',
  type: 'resume',
  title: 'Alice Anderson Resume',
  content: '**Alice Anderson**\nNewark, NJ',
  versionNumber: 1,
  updatedAt: new Date().toISOString(),
  job: null,
};

const noop = {
  onView: jest.fn(),
  onDuplicate: jest.fn(),
  onRename: jest.fn(),
  onArchive: jest.fn(),
  onRestore: jest.fn(),
};

describe('DocumentCard', () => {
  // HAPPY PATH: renders baseline fields
  it('renders document title, type badge, version and date', () => {
    render(<DocumentCard doc={mockDoc} {...noop} />);
    expect(screen.getByTestId('document-title')).toHaveTextContent('Alice Anderson Resume');
    expect(screen.getByTestId('document-type')).toHaveTextContent('Resume');
    expect(screen.getByTestId('document-version')).toHaveTextContent('v1');
    expect(screen.getByTestId('document-date')).toBeInTheDocument();
  });

  // HAPPY PATH: cover letter type renders correct label
  it('renders correct badge label for cover_letter type', () => {
    const coverLetterDoc = { ...mockDoc, type: 'cover_letter' };
    render(<DocumentCard doc={coverLetterDoc} {...noop} />);
    expect(screen.getByTestId('document-type')).toHaveTextContent('Cover Letter');
  });

  // HAPPY PATH: view button calls onView with the document
  it('calls onView with the document when View is clicked', () => {
    const mockOnView = jest.fn();
    render(<DocumentCard doc={mockDoc} {...noop} onView={mockOnView} />);
    fireEvent.click(screen.getByTestId('document-view-button'));
    expect(mockOnView).toHaveBeenCalledWith(mockDoc);
  });

  // HAPPY PATH: linked job renders a link with correct href
  it('renders linked job with correct href when job is present', () => {
    const docWithJob = {
      ...mockDoc,
      job: { id: 'job-1', title: 'Registered Nurse', company: 'City Hospital' },
    };
    render(<DocumentCard doc={docWithJob} {...noop} />);
    const jobLink = screen.getByTestId('document-job-link');
    expect(jobLink).toHaveAttribute('href', '/jobs/job-1');
    expect(jobLink).toHaveTextContent('Registered Nurse at City Hospital');
  });

  // NON-HAPPY PATH: no job renders without crashing and without a job link
  it('does not render a job link when job is null', () => {
    render(<DocumentCard doc={mockDoc} {...noop} />);
    expect(screen.queryByTestId('document-job-link')).not.toBeInTheDocument();
  });

  // NON-HAPPY PATH: unknown type falls back to default badge gracefully
  it('renders correctly with unknown document type', () => {
    const unknownTypeDoc = { ...mockDoc, type: 'unknown_type' };
    render(<DocumentCard doc={unknownTypeDoc} {...noop} />);
    expect(screen.getByTestId('document-card')).toBeInTheDocument();
  });

  // NON-HAPPY PATH: invalid date renders gracefully
  it('renders gracefully with invalid date', () => {
    const docWithBadDate = { ...mockDoc, updatedAt: 'invalid-date' };
    render(<DocumentCard doc={docWithBadDate} {...noop} />);
    expect(screen.getByTestId('document-card')).toBeInTheDocument();
  });

  // NON-HAPPY PATH: null content does not crash rendering
  it('renders gracefully when content is null', () => {
    const docWithNullContent = { ...mockDoc, content: null };
    render(<DocumentCard doc={docWithNullContent} {...noop} />);
    expect(screen.getByTestId('document-card')).toBeInTheDocument();
  });

  // S3-006: status badge
  it('renders active status badge when status is active', () => {
    const docWithStatus = { ...mockDoc, status: 'active' };
    render(<DocumentCard doc={docWithStatus} {...noop} />);
    expect(screen.getByTestId('document-status')).toHaveTextContent('Active');
  });

  it('renders archived status badge when archivedAt is set, regardless of status field', () => {
    const docArchived = { ...mockDoc, status: 'active', archivedAt: new Date().toISOString() };
    render(<DocumentCard doc={docArchived} {...noop} />);
    expect(screen.getByTestId('document-status')).toHaveTextContent('Archived');
  });

  it('does not render a status badge when neither status nor archivedAt is provided', () => {
    render(<DocumentCard doc={mockDoc} {...noop} />);
    expect(screen.queryByTestId('document-status')).not.toBeInTheDocument();
  });

  // S3-006: tag chips
  it('renders tag chips when tags are present', () => {
    const docWithTags = { ...mockDoc, tags: ['urgent', 'referral'] };
    render(<DocumentCard doc={docWithTags} {...noop} />);
    const tagContainer = screen.getByTestId('document-tags');
    expect(tagContainer).toHaveTextContent('urgent');
    expect(tagContainer).toHaveTextContent('referral');
  });

  it('does not render tag chips when tags is empty or undefined', () => {
    render(<DocumentCard doc={mockDoc} {...noop} />);
    expect(screen.queryByTestId('document-tags')).not.toBeInTheDocument();
  });

  // S3-007: Duplicate
  it('calls onDuplicate with the document when Duplicate is clicked', () => {
    const mockOnDuplicate = jest.fn();
    render(<DocumentCard doc={mockDoc} {...noop} onDuplicate={mockOnDuplicate} />);
    fireEvent.click(screen.getByTestId('document-duplicate-button'));
    expect(mockOnDuplicate).toHaveBeenCalledWith(mockDoc);
  });

  // S3-007: Rename
  it('shows a rename input pre-filled with the current title when Rename is clicked', () => {
    render(<DocumentCard doc={mockDoc} {...noop} />);
    fireEvent.click(screen.getByTestId('document-rename-button'));
    const input = screen.getByTestId('document-rename-input') as HTMLInputElement;
    expect(input.value).toBe('Alice Anderson Resume');
  });

  it('calls onRename with the new title when Save is clicked after editing', () => {
    const mockOnRename = jest.fn();
    render(<DocumentCard doc={mockDoc} {...noop} onRename={mockOnRename} />);
    fireEvent.click(screen.getByTestId('document-rename-button'));
    fireEvent.change(screen.getByTestId('document-rename-input'), {
      target: { value: 'Updated Resume Title' },
    });
    fireEvent.click(screen.getByTestId('document-rename-save'));
    expect(mockOnRename).toHaveBeenCalledWith(mockDoc, 'Updated Resume Title');
  });

  it('submits rename when Enter is pressed in the input', () => {
    const mockOnRename = jest.fn();
    render(<DocumentCard doc={mockDoc} {...noop} onRename={mockOnRename} />);
    fireEvent.click(screen.getByTestId('document-rename-button'));
    fireEvent.change(screen.getByTestId('document-rename-input'), {
      target: { value: 'Enter Saved Title' },
    });
    fireEvent.keyDown(screen.getByTestId('document-rename-input'), { key: 'Enter' });
    expect(mockOnRename).toHaveBeenCalledWith(mockDoc, 'Enter Saved Title');
  });

  it('discards the edit and does not call onRename when Cancel is clicked', () => {
    const mockOnRename = jest.fn();
    render(<DocumentCard doc={mockDoc} {...noop} onRename={mockOnRename} />);
    fireEvent.click(screen.getByTestId('document-rename-button'));
    fireEvent.change(screen.getByTestId('document-rename-input'), {
      target: { value: 'Should Not Save' },
    });
    fireEvent.click(screen.getByTestId('document-rename-cancel'));
    expect(mockOnRename).not.toHaveBeenCalled();
    expect(screen.getByTestId('document-title')).toHaveTextContent('Alice Anderson Resume');
  });

  it('cancels rename when Escape is pressed', () => {
    const mockOnRename = jest.fn();
    render(<DocumentCard doc={mockDoc} {...noop} onRename={mockOnRename} />);
    fireEvent.click(screen.getByTestId('document-rename-button'));
    fireEvent.keyDown(screen.getByTestId('document-rename-input'), { key: 'Escape' });
    expect(mockOnRename).not.toHaveBeenCalled();
    expect(screen.getByTestId('document-title')).toHaveTextContent('Alice Anderson Resume');
  });

  it('does not call onRename when the title is unchanged', () => {
    const mockOnRename = jest.fn();
    render(<DocumentCard doc={mockDoc} {...noop} onRename={mockOnRename} />);
    fireEvent.click(screen.getByTestId('document-rename-button'));
    fireEvent.click(screen.getByTestId('document-rename-save'));
    expect(mockOnRename).not.toHaveBeenCalled();
  });

  it('does not call onRename when the title is emptied out', () => {
    const mockOnRename = jest.fn();
    render(<DocumentCard doc={mockDoc} {...noop} onRename={mockOnRename} />);
    fireEvent.click(screen.getByTestId('document-rename-button'));
    fireEvent.change(screen.getByTestId('document-rename-input'), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId('document-rename-save'));
    expect(mockOnRename).not.toHaveBeenCalled();
  });

  // S3-008: Archive / Restore
  // HAPPY PATH: active document shows Archive button, calls onArchive when clicked
  it('shows an Archive button for an active document and calls onArchive when clicked', () => {
    const mockOnArchive = jest.fn();
    render(<DocumentCard doc={mockDoc} {...noop} onArchive={mockOnArchive} />);
    const archiveButton = screen.getByTestId('document-archive-button');
    expect(archiveButton).toBeInTheDocument();
    expect(screen.queryByTestId('document-restore-button')).not.toBeInTheDocument();
    fireEvent.click(archiveButton);
    expect(mockOnArchive).toHaveBeenCalledWith(mockDoc);
  });

  // HAPPY PATH: archived document shows Restore button, calls onRestore when clicked
  it('shows a Restore button for an archived document and calls onRestore when clicked', () => {
    const mockOnRestore = jest.fn();
    const archivedDoc = { ...mockDoc, archivedAt: new Date().toISOString() };
    render(<DocumentCard doc={archivedDoc} {...noop} onRestore={mockOnRestore} />);
    const restoreButton = screen.getByTestId('document-restore-button');
    expect(restoreButton).toBeInTheDocument();
    expect(screen.queryByTestId('document-archive-button')).not.toBeInTheDocument();
    fireEvent.click(restoreButton);
    expect(mockOnRestore).toHaveBeenCalledWith(archivedDoc);
  });

  // NON-HAPPY PATH: archived documents do not show a Rename button
  it('does not show a Rename button for an archived document', () => {
    const archivedDoc = { ...mockDoc, archivedAt: new Date().toISOString() };
    render(<DocumentCard doc={archivedDoc} {...noop} />);
    expect(screen.queryByTestId('document-rename-button')).not.toBeInTheDocument();
  });

  // NON-HAPPY PATH: archived documents do not show a Duplicate button —
  // must be restored first, since duplicating from an archived source is
  // ambiguous (should the copy be active or archived?) and easy to misread.
  it('does not show a Duplicate button for an archived document', () => {
    const archivedDoc = { ...mockDoc, archivedAt: new Date().toISOString() };
    render(<DocumentCard doc={archivedDoc} {...noop} />);
    expect(screen.queryByTestId('document-duplicate-button')).not.toBeInTheDocument();
  });

  // NON-HAPPY PATH: archived documents still show the View button
  it('still shows the View button for an archived document', () => {
    const archivedDoc = { ...mockDoc, archivedAt: new Date().toISOString() };
    render(<DocumentCard doc={archivedDoc} {...noop} />);
    expect(screen.getByTestId('document-view-button')).toBeInTheDocument();
  });
});
