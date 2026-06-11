import NavBar from './NavBar';

interface Props {
  children: React.ReactNode;
}

export default function AppShell({ children }: Props) {
  return (
    <div className="app-shell">
      <NavBar />
      <main className="app-shell__content" id="main-content">
        {children}
      </main>
    </div>
  );
}