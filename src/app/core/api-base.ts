export function getApiBase(): string {
  try {
    const host = window.location.hostname;
    return host.endsWith('creasia.es') ? '/api' : 'https://creasia.es/api';
  } catch {
    return 'https://creasia.es/api';
  }
}
