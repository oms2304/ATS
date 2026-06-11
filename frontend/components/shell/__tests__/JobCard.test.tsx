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
  updatedAt: '2024-01-02T00:00:00Z',
};

describe('JobCard', () => {
  // HAPPY PATH: renders baseline fields
  it('renders job title, company, stage and date', () => {
    render(<JobCard job={mockJob} onEdit={jest.fn()} />);
    expect(screen.getByTestId('job-title')).toHaveTextContent('Frontend Developer');
    expect(screen.getByTestId('job-company')).toHaveTextContent('Acme Corp');
    expect(screen.getByTestId('job-stage')).toHaveTextContent('Applied');
    expect(screen.getByTestId('job-date')).toBeInTheDocument();
  });

  // HAPPY PATH: progress bar renders
  it('renders progress bar', () => {
    render(<JobCard job={mockJob} onEdit={jest.fn()} />);
    const progress = screen.getByTestId('job-progress');
    expect(progress).toBeInTheDocument();
    expect(progress).toHaveStyle({ width: '40%' });
  });

  // HAPPY PATH: edit button calls onEdit
  it('calls onEdit when edit button is clicked', () => {
    const mockOnEdit = jest.fn();
    render(<JobCard job={mockJob} onEdit={mockOnEdit} />);
    fireEvent.click(screen.getByText('Edit'));
    expect(mockOnEdit).toHaveBeenCalledWith(mockJob);
  });

  // HAPPY PATH: view link has correct href
  it('renders view link with correct job id', () => {
    render(<JobCard job={mockJob} onEdit={jest.fn()} />);
    const viewLink = screen.getByText('View').closest('a');
    expect(viewLink).toHaveAttribute('href', '/jobs/1');
  });

  // NON-HAPPY PATH: unknown stage falls back to default badge
  it('renders correctly with unknown stage', () => {
    const jobWithUnknownStage = { ...mockJob, stage: 'Unknown' };
    render(<JobCard job={jobWithUnknownStage} onEdit={jest.fn()} />);
    expect(screen.getByTestId('job-stage')).toHaveTextContent('Unknown');
  });

  // NON-HAPPY PATH: invalid date renders gracefully
  it('renders gracefully with invalid date', () => {
    const jobWithBadDate = { ...mockJob, updatedAt: 'invalid-date' };
    render(<JobCard job={jobWithBadDate} onEdit={jest.fn()} />);
    expect(screen.getByTestId('job-card')).toBeInTheDocument();
  });
});