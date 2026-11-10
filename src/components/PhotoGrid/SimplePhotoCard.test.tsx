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
    render(<SimplePhotoCard photo={photo} size="medium" onOpen={vi.fn()} isAboveFold={false} />);

    const image = screen.getByRole('img', { name: photo.name });
    expect(image).toHaveAttribute('loading', 'lazy');
    expect(image).not.toHaveStyle({ display: 'none' });
    expect(image).toHaveStyle({ opacity: '0' });

    fireEvent.error(image);
    expect(image).toHaveAttribute('src', expect.stringContaining(`/api/photos/${photo.id}/file`));
    fireEvent.load(image);
    expect(image).toHaveStyle({ opacity: '1' });
  });

  it('opens through a single activation path for pointer and keyboard', () => {
    const onOpen = vi.fn();
    render(<SimplePhotoCard photo={photo} size="medium" onOpen={onOpen} />);

    const card = screen.getByRole('button', { name: `Open ${photo.name}` });
    fireEvent.click(card);
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it('keeps a finite aspect ratio when metadata is incomplete', () => {
    render(<SimplePhotoCard photo={{ ...photo, width: 0, height: 0 }} size="medium" onOpen={vi.fn()} />);
    const card = screen.getByRole('button', { name: `Open ${photo.name}` });
    expect(card).toHaveStyle({ aspectRatio: '1' });
  });

  it('participates in the grid roving tabindex', () => {
    const { rerender } = render(
      <SimplePhotoCard photo={photo} size="medium" onOpen={vi.fn()} index={3} tabIndex={-1} />,
    );
    const card = screen.getByRole('button', { name: `Open ${photo.name}` });
    expect(card).toHaveAttribute('data-grid-index', '3');
    expect(card).toHaveAttribute('tabindex', '-1');

    rerender(<SimplePhotoCard photo={photo} size="medium" onOpen={vi.fn()} index={3} tabIndex={0} />);
    expect(screen.getByRole('button', { name: `Open ${photo.name}` })).toHaveAttribute('tabindex', '0');
  });

  it('requests responsive thumbnails through srcset', () => {
    render(<SimplePhotoCard photo={photo} size="medium" onOpen={vi.fn()} />);
    const image = screen.getByRole('img', { name: photo.name });
    expect(image).toHaveAttribute(
      'srcset',
      expect.stringContaining('/thumbnail?name=missing-thumbnail&w=300 300w'),
    );
    expect(image).toHaveAttribute('sizes');
  });
});
