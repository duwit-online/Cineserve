export interface MediaMetadata {
  media_id: string;
  media_type: 'movie' | 'tv';
  plot?: string;
  cast?: string;
  crew?: any[];
  director?: string;
  rating?: number;
  year?: number;
  genres?: string;
  runtime?: string;
  backdrop?: string;
  poster?: string;
  tagline?: string;
  status?: string;
  production_companies?: string[];
  recommendations?: any[];
}

export interface MediaItem {
  id: string;
  title: string;
  poster: string | null;
  file?: string;
  folder?: string;
  metadata?: MediaMetadata;
}

export interface PlaybackProgress {
  media_id: string;
  media_type: 'movie' | 'tv';
  episode_id: string;
  position_seconds: number;
  duration_seconds: number;
  updated_at: string;
}

export type View = 'home' | 'movies' | 'tv' | 'watchlist' | 'history' | 'profile';
