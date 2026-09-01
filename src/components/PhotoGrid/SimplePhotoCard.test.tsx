import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PhotoMetadata } from '@/types';
import { SimplePhotoCard } from './SimplePhotoCard';

const photo = {
  id: 'photo-1',
  name: 'missing-thumbnail',
  ext: 'jpg',
  width: 1200,
  height: 800,
  size: 100,
  btime: 1,
  mtime: 1,
  tags: [],
  folders: [],
  isDeleted: false,
  url: '',
  annotation: '',
  modificationTime: 1,
  lastModified: 1,
} satisfies PhotoMetadata;

describe('SimplePhotoCard', () => {
  it('keeps lazy images in layout and falls back to the original media', () => {
    render(<SimplePhotoCard photo={photo} size="medium" onDoubleClick={vi.fn()} isAboveFold={false} />);

    const image = screen.getByRole('img', { name: photo.name });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).not.toHaveStyle({ display: 'none' });
    expect(image).toHaveStyle({ opacity: '0' });

    fireEvent.error(image);
    expect(image).toHaveAttribute('src', expect.stringContaining(`/api/photos/${photo.id}/file`));
    fireEvent.load(image);
    expect(image).toHaveStyle({ opacity: '1' });
  });
});
