const REQUIRED = [
  'LASTFM_API_KEY',
  'LASTFM_SHARED_SECRET',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SESSION_SECRET',
  'MONGODB_URI',
] as const;

const SESSION_SECRET_MIN_LENGTH = 32;

export function validate(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const missing = REQUIRED.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const secret = config['SESSION_SECRET'] as string;
  if (secret.length < SESSION_SECRET_MIN_LENGTH) {
    throw new Error(
      `SESSION_SECRET must be at least ${SESSION_SECRET_MIN_LENGTH} characters`,
    );
  }

  return config;
}
