import React from 'react';
import { cn } from '@/utils/cn';

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only controls need an accessible name. */
  label: string;
  active?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Square icon-only control used across the header, toolbars and viewer.
 * Collapses what used to be a repeated `p-2 text-gray-500 hover:bg-gray-100
 * dark:text-gray-400 dark:hover:bg-gray-900` string in a dozen components.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, active = false, size = 'md', className, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={props['aria-pressed'] ?? (active || undefined)}
      title={props.title ?? label}
      className={cn(
        'inline-grid place-items-center rounded-lg transition-[background-color,color,transform] duration-200 ease-out-soft',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-40 active:scale-95',
        size === 'sm' ? 'size-8' : 'size-9',
        active
          ? 'bg-primary-soft text-primary'
          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = 'IconButton';

export default IconButton;
