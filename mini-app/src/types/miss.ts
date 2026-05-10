export interface MissTheme {
  background: string;
  glow: string;
  text: string;
  accent: string;
}

export type PlanetPosition = 'topLeft' | 'topRight' | 'topCenter';

export interface InterviewQA {
  question: string;
  answer: string;
}

export interface Miss {
  id: string;
  order: number;
  firstName: string;
  lastName?: string;
  username?: string;
  className?: string;
  instagramUrl?: string;
  quote: string;
  previewImage: string;
  heroImage?: string;
  planetImage: string;
  gallery: string[];
  description?: string;
  interview?: InterviewQA[];
  theme: MissTheme;
  planetPosition: PlanetPosition;
  isPublished: boolean;
  publishAt?: string;
}

export interface DisplayMiss extends Miss {
  available: boolean;
}
