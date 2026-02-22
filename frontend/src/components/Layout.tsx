import { Link, useLocation } from "react-router-dom";
import { Logo } from "@/components/Logo";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const loc = useLocation();
  const isEncounter = loc.pathname.startsWith("/encounter");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-clinical-border bg-clinical-surface px-4 py-3 flex items-center justify-between">
        <Logo variant="header" />
        <nav className="flex items-center gap-4 text-sm text-clinical-muted">
          {!isEncounter && (
            <Link
              to="/encounter"
              className="text-clinical-primary hover:text-clinical-primaryHover font-medium"
            >
              New encounter
            </Link>
          )}
        </nav>
      </header>
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
