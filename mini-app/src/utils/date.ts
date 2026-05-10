import type { Miss } from '@/types/miss';

export function isMissAvailable(miss: Miss): boolean {
  if (miss.isPublished) return true;
  if (miss.publishAt) {
    return new Date(miss.publishAt) <= new Date();
  }
  return false;
}

export function getAvailableMisses(allMisses: Miss[]): Miss[] {
  return allMisses
    .filter(isMissAvailable)
    .sort((a, b) => a.order - b.order);
}
