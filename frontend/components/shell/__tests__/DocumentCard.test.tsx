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

describe('DocumentCard', () => {
  // HAPPY PATH: renders baseline fields
  it('renders document title, type badge, version and date', () => {
    render(<DocumentCard doc={mockDoc} onView={jest.fn()} />);
    expect(screen.getByTestId('document-title')).toHaveTextContent('Alice Anderson Resume');
    expect(screen.getByTestId('document-type')).toHaveTextContent('Resume');
    expect(screen.getByTestId('document-version')).toHaveTextContent('v1');
    expect(screen.getByTestId('document-date')).toBeInTheDocument();
  });

  // HAPPY PATH: cover letter type renders correct label
  it('renders correct badge label for cover_letter type', () => {
    const coverLetterDoc = { ...mockDoc, type: 'cover_letter' };
    render(<DocumentCard doc={coverLetterDoc} onView={jest.fn()} />);
    expect(screen.getByTestId('document-type')).toHaveTextContent('Cover Letter');
  });

  // HAPPY PATH: view button calls onView with the document
  it('calls onView with the document when View is clicked', () => {
    const mockOnView = jest.fn();
    render(<DocumentCard doc={mockDoc} onView={mockOnView} />);
    fireEvent.click(screen.getByTestId('document-view-button'));
    expect(mockOnView).toHaveBeenCalledWith(mockDoc);
  });

  // HAPPY PATH: linked job renders a link with correct href
  it('renders linked job with correct href when job is present', () => {
    const docWithJob = {
      ...mockDoc,
      job: { id: 'job-1', title: 'Registered Nurse', company: 'City Hospital' },
    };
    render(<DocumentCard doc={docWithJob} onView={jest.fn()} />);
    const jobLink = screen.getByTestId('document-job-link');
    expect(jobLink).toHaveAttribute('href', '/jobs/job-1');
    expect(jobLink).toHaveTextContent('Registered Nurse at City Hospital');
  });

  // NON-HAPPY PATH: no job renders without crashing and without a job link
  it('does not render a job link when job is null', () => {
    render(<DocumentCard doc={mockDoc} onView={jest.fn()} />);
    expect(screen.queryByTestId('document-job-link')).not.toBeInTheDocument();
  });

  // NON-HAPPY PATH: unknown type falls back to default badge gracefully
  it('renders correctly with unknown document type', () => {
    const unknownTypeDoc = { ...mockDoc, type: 'unknown_type' };
    render(<DocumentCard doc={unknownTypeDoc} onView={jest.fn()} />);
    expect(screen.getByTestId('document-card')).toBeInTheDocument();
  });

  // NON-HAPPY PATH: invalid date renders gracefully
  it('renders gracefully with invalid date', () => {
    const docWithBadDate = { ...mockDoc, updatedAt: 'invalid-date' };
    render(<DocumentCard doc={docWithBadDate} onView={jest.fn()} />);
    expect(screen.getByTestId('document-card')).toBeInTheDocument();
  });

  // NON-HAPPY PATH: null content does not crash rendering
  it('renders gracefully when content is null', () => {
    const docWithNullContent = { ...mockDoc, content: null };
    render(<DocumentCard doc={docWithNullContent} onView={jest.fn()} />);
    expect(screen.getByTestId('document-card')).toBeInTheDocument();
  });

  // HAPPY PATH: S3-006 status badge renders when status is present
  it('renders active status badge when status is active', () => {
    const docWithStatus = { ...mockDoc, status: 'active' };
    render(<DocumentCard doc={docWithStatus} onView={jest.fn()} />);
    expect(screen.getByTestId('document-status')).toHaveTextContent('Active');
  });

  it('renders archived status badge when status is archived', () => {
    const docWithStatus = { ...mockDoc, status: 'archived' };
    render(<DocumentCard doc={docWithStatus} onView={jest.fn()} />);
    expect(screen.getByTestId('document-status')).toHaveTextContent('Archived');
  });

  // NON-HAPPY PATH: no status badge rendered when status is undefined
  it('does not render a status badge when status is not provided', () => {
    render(<DocumentCard doc={mockDoc} onView={jest.fn()} />);
    expect(screen.queryByTestId('document-status')).not.toBeInTheDocument();
  });

  // HAPPY PATH: S3-006 tag chips render when tags are present
  it('renders tag chips when tags are present', () => {
    const docWithTags = { ...mockDoc, tags: ['urgent', 'referral'] };
    render(<DocumentCard doc={docWithTags} onView={jest.fn()} />);
    const tagContainer = screen.getByTestId('document-tags');
    expect(tagContainer).toHaveTextContent('urgent');
    expect(tagContainer).toHaveTextContent('referral');
  });

  // NON-HAPPY PATH: no tag container rendered when tags is empty or undefined
  it('does not render tag chips when tags is empty or undefined', () => {
    render(<DocumentCard doc={mockDoc} onView={jest.fn()} />);
    expect(screen.queryByTestId('document-tags')).not.toBeInTheDocument();
  });
});
