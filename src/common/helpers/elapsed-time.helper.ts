export function formatElapsedTime(startedAt: Date | string | null | undefined, now = new Date()): string {
  if (!startedAt) {
    return 'Unavailable';
  }

  const parsedStartedAt = new Date(startedAt);

  if (Number.isNaN(parsedStartedAt.getTime()) || Number.isNaN(now.getTime())) {
    return 'Unavailable';
  }

  const elapsedMilliseconds = now.getTime() - parsedStartedAt.getTime();

  if (elapsedMilliseconds < 0) {
    return 'Unavailable';
  }

  const totalSeconds = Math.floor(elapsedMilliseconds / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}
