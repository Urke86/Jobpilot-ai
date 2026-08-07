import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts';
import { ErrorBoundary } from '@/components/common';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ErrorBoundary>{children}</ErrorBoundary>
      </BrowserRouter>
    </ThemeProvider>
  );
}
