import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
      '@kiwi/contracts': path.resolve(root, 'packages/contracts/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'packages/contracts/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'packages/contracts/src/**/*.ts',
        'src/utils/folderUrls.ts',
        'src/utils/fileTypes.ts',
        'src/utils/imageFormats.ts',
        'src/utils/formatBytes.ts',
        'src/utils/tagUrls.ts',
        'src/services/apiClient.ts',
        'src/hooks/queryKeys.ts',
        'src/hooks/useInfinitePhotos.ts',
        'src/hooks/useSearchPhotos.ts',
        'src/store/index.ts',
      ],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
