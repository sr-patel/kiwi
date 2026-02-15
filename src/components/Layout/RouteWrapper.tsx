import React from 'react';
import { ApiErrorBoundary } from '@/components/ErrorBoundary/ApiErrorBoundary';

interface RouteWrapperProps {
  children: React.ReactNode;
}

export const RouteWrapper: React.FC<RouteWrapperProps> = ({ children }) => {
  return (
    <ApiErrorBoundary>
      {children}
    </ApiErrorBoundary>
  );
};
