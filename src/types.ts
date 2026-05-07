export interface MediaMetadata {
  media_id: string;
  media_type: 'movie' | 'tv';
  plot?: string;
  cast?: string;
  director?: string;
  rating?: number;
  year?: number;
  genres?: string;
  runtime?: string;
  backdrop?: string;
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
