const REQUIRED = [
  'LASTFM_API_KEY',
  'LASTFM_SHARED_SECRET',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SESSION_SECRET',
  'MONGODB_URI',
] as const;

const SESSION_SECRET_MIN_LENGTH = 32;

// Single home for optional-var defaults — call sites use getOrThrow.
const DEFAULTS: Record<string, string> = {
  PUBLIC_URL: 'http://localhost:5342',
  REDIS_URL: 'redis://redis:6379',
  PORT: '5342',
  TOP_TRACKS_YEARLY: '100',
  TOP_TRACKS_SEASONAL: '40',
  TOP_TRACKS_MONTHLY: '25',
  MIN_TRACKS_FOR_PLAYLIST: '10',
  MIN_LASTFM_TRACKS: '5',
  TRACK_MISS_RECHECK_DAYS: '30',
};

export function validate(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!config[key]) config[key] = value;
  }

  const secret = config['SESSION_SECRET'] as string;
  if (secret.length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be at least ${SESSION_SECRET_MIN_LENGTH} characters`,
    );
  }

  return config;
}
