import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import DocumentsPage from '../../../app/(dashboard)/documents/page';
import * as api from '@/lib/api';

expect.extend(toHaveNoViolations);

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

const mockDocs = [
  {
    id: 'doc-1',
    type: 'resume',
    title: 'Alice Anderson Resume',
    content: 'Resume content here',
    versionNumber: 1,
    updatedAt: '2024-01-02T00:00:00Z',
    status: 'active',
    tags: ['urgent'],
    job: null,
  },
];

describe('DocumentsPage - S3-019 Accessibility', () => {
  it('has no detectable accessibility violations (populated state)', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: mockDocs });
    const { container, findByText } = render(<DocumentsPage />);
    await findByText('Alice Anderson Resume');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('has no detectable accessibility violations (empty state)', async () => {
    (api.apiFetch as jest.Mock).mockResolvedValue({ success: true, data: [] });
    const { container, findByText } = render(<DocumentsPage />);
    await findByText(/No saved documents yet/i);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
