// Public, build-time configuration shared by browser and server fetches.
// Keep the legacy variable as an alias for existing local setups.
export const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_API_URL
  ?? 'http://localhost:3001').replace(/\/$/, '');
