import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobCard } from '../../ui/job-card';

jest.mock('next/link', () => {
  const MockLink = (props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => {
    const { href, children, ...rest } = props;
    return <a href={href} {...rest}>{children}</a>;
  };
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const mockJob = {
  id: '1',
  title: 'Frontend Developer',
  company: 'Acme Corp',
  stage: 'Applied',
  updatedAt: new Date().toISOString(), // today = not stale
};

describe('JobCard', () => {
  // HAPPY PATH: renders baseline fields
  it('renders job title, company, stage and date', () => {
    render(<JobCard job={mockJob} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />);
    expect(screen.getByTestId('job-title')).toHaveTextContent('Frontend Developer');
    expect(screen.getByTestId('job-company')).toHaveTextContent('Acme Corp');
    expect(screen.getByTestId('job-stage')).toHaveTextContent('Applied');
    expect(screen.getByTestId('job-date')).toBeInTheDocument();
  });

  // HAPPY PATH: progress bar renders
  it('renders progress bar', () => {
    render(<JobCard job={mockJob} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />);
    const progress = screen.getByTestId('job-progress');
    expect(progress).toBeInTheDocument();
    expect(progress).toHaveStyle({ width: '40%' });
  });

  // HAPPY PATH: edit button calls onEdit
  it('calls onEdit when edit button is clicked', () => {
    const mockOnEdit = jest.fn();
    render(<JobCard job={mockJob} onEdit={mockOnEdit} onArchive={jest.fn()} onRestore={jest.fn()} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(mockOnEdit).toHaveBeenCalledWith(mockJob);
  });

  // HAPPY PATH: view link has correct href
  it('renders view link with correct job id', () => {
    render(<JobCard job={mockJob} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />);
    const viewLink = screen.getByText('View').closest('a');
    expect(viewLink).toHaveAttribute('href', '/jobs/1');
  });

  // NON-HAPPY PATH: unknown stage falls back to default badge
  it('renders correctly with unknown stage', () => {
    const jobWithUnknownStage = { ...mockJob, stage: 'Unknown' };
    render(<JobCard job={jobWithUnknownStage} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />);
    expect(screen.getByTestId('job-stage')).toHaveTextContent('Unknown');
  });

  // NON-HAPPY PATH: invalid date renders gracefully
  it('renders gracefully with invalid date', () => {
    const jobWithBadDate = { ...mockJob, updatedAt: 'invalid-date' };
    render(<JobCard job={jobWithBadDate} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />);
    expect(screen.getByTestId('job-card')).toBeInTheDocument();
  });

  // S2-004 Stage Indicator Tests
it('shows stale indicator when job not updated for 7+ days', () => {
  const staleJob = {
    ...mockJob,
    stage: 'Applied',
    updatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  };
  render(<JobCard job={staleJob} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />);
  expect(screen.getByTestId('job-stale')).toBeInTheDocument();
  expect(screen.getByTestId('job-stale')).toHaveTextContent('Stale');
});

it('does not show stale indicator for recently updated job', () => {
  render(<JobCard job={mockJob} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />);
  expect(screen.queryByTestId('job-stale')).not.toBeInTheDocument();
});

it('does not show stale indicator for Rejected jobs', () => {
  const rejectedJob = {
    ...mockJob,
    stage: 'Rejected',
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  render(<JobCard job={rejectedJob} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />);
  expect(screen.queryByTestId('job-stale')).not.toBeInTheDocument();
});

it('does not show stale indicator for archived jobs', () => {
  const archivedJob = {
    ...mockJob,
    archivedAt: new Date().toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  };
  render(<JobCard job={archivedJob} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />);
  expect(screen.queryByTestId('job-stale')).not.toBeInTheDocument();
});

it('preserves and shows the real stage for archived jobs', () => {
  const archivedJob = {
    ...mockJob,
    stage: 'Applied',
    archivedAt: new Date().toISOString(),
  };
  render(<JobCard job={archivedJob} onEdit={jest.fn()} onStageChange={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />);
  // Archived cards show a read-only badge, not the editable StageSelect dropdown
  expect(screen.getByTestId('job-stage')).toHaveTextContent('Applied');
});

});