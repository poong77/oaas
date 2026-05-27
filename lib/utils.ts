import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Tailwind class merge utility */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
