import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  // Unmount rendered trees between tests. Without this, queries that match by
  // role and accessible name find nodes left over from earlier tests.
  cleanup();
  localStorage.clear();
});
