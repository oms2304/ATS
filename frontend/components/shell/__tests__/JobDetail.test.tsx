import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { AuthContext } from '@/context/AuthContext';
import { JobCard } from '@/components/ui/job-card';

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  useParams: jest.fn(() => ({ id: '1' })),
}));

jest.mock('next/link', () => {
  const MockLink = (props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => {
    const { href, children, ...rest } = props;
    return <a href={href} {...rest}>{children}</a>;
  };
  MockLink.displayName = 'MockLink';
  return MockLink;
});

const mockUser = { userId: '1', name: 'Jane Doe', email: 'jane@example.com' };

const mockCardJob = {
  id: '1',
  title: 'Frontend Developer',
  company: 'Acme Corp',
  stage: 'Applied',
  updatedAt: new Date().toISOString(),
};

describe('S2-005 - Job Card to Job Detail Expansion', () => {
  it('job card links to correct job detail URL', () => {
    render(
      <AuthContext.Provider value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: jest.fn(), setUser: jest.fn() }}>
        <JobCard job={mockCardJob} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />
      </AuthContext.Provider>
    );
    const link = screen.getByTestId('job-card').closest('a');
    expect(link).toHaveAttribute('href', '/jobs/1');
  });

  it('job card displays baseline fields for detail navigation', () => {
    render(
      <AuthContext.Provider value={{ user: mockUser, isLoading: false, login: jest.fn(), logout: jest.fn(), setUser: jest.fn() }}>
        <JobCard job={mockCardJob} onEdit={jest.fn()} onArchive={jest.fn()} onRestore={jest.fn()} />
      </AuthContext.Provider>
    );
    expect(screen.getByTestId('job-title')).toHaveTextContent('Frontend Developer');
    expect(screen.getByTestId('job-company')).toHaveTextContent('Acme Corp');
    expect(screen.getByTestId('job-stage')).toHaveTextContent('Applied');
  });
});