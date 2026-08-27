import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes so later ones win conflicts.
 * `cn('p-2', 'p-4')` -> `'p-4'` (plain clsx would keep both).
 */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}
