import { Link } from '@tanstack/react-router';
import { Home, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-full flex items-center justify-center bg-default-50 p-6">
      <div className="text-center max-w-md">
        <p className="text-8xl font-extrabold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-default-500">The page you're looking for doesn't exist or has been moved.</p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <button onClick={() => window.history.back()} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-divider text-sm font-medium text-foreground hover:bg-default-100 transition-colors">
            <ArrowLeft size={16} /> Go Back
          </button>
          <Link to="/" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-hover transition-colors">
            <Home size={16} /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}
