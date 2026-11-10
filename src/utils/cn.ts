import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges conditional class names and resolves Tailwind conflicts so that a
 * caller's override always wins over a component's default (e.g. passing
 * `px-5` to a button that defaults to `px-3`).
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
