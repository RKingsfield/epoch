export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function httpStatus(err: unknown): number | undefined {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { status?: number } }).response;
    return response?.status;
  }
  return undefined;
}
