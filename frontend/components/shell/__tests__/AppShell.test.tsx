import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import AppShell from '../AppShell';

jest.mock('../NavBar', () => {
  const MockNavBar = () => <nav data-testid="navbar">NavBar</nav>;
  MockNavBar.displayName = 'MockNavBar';
  return MockNavBar;
});

describe('AppShell', () => {
  it('renders children inside main content area', () => {
    render(<AppShell><p>Test Content</p></AppShell>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('renders the NavBar', () => {
    render(<AppShell><p>Content</p></AppShell>);
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
  });
});