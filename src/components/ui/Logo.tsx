import React from 'react';
import { cn } from '@/utils/cn';

interface LogoProps {
  /** Edge length of the squircle in px. */
  size?: number;
  className?: string;
  /** Set false to render the bare glyph with no accent plate. */
  plate?: boolean;
}

/**
 * The kiwi mark, tinted by the active accent.
 *
 * The shipped PNG has the accent colour baked into its background, so it could
 * never follow the user's accent choice. Instead `public/kiwi-mark.png` is a
 * single-channel alpha mask of the glyph (derived from the original art), and
 * this component paints it with theme tokens:
 *
 *   plate -> bg-primary            glyph -> bg-primary-foreground
 *
 * which gives correct contrast in light mode (deep fill, white glyph) and dark
 * mode (pastel fill, dark glyph) with no JavaScript involved.
 */
export const Logo: React.FC<LogoProps> = ({ size = 32, className, plate = true }) => {
  const glyph = Math.round(size * 0.74);
  const maskStyle: React.CSSProperties = {
    width: glyph,
    height: glyph,
    maskImage: 'url(/kiwi-mark.png)',
    WebkitMaskImage: 'url(/kiwi-mark.png)',
    maskSize: 'contain',
    WebkitMaskSize: 'contain',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskPosition: 'center',
  };

  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid shrink-0 place-items-center overflow-hidden rounded-[28%]',
        plate && 'bg-primary',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <span className="block bg-primary-foreground" style={maskStyle} />
    </span>
  );
};

export default Logo;
