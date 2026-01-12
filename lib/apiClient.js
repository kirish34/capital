import { supabase } from './supabaseClient.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

/**
 * Wrapper that attaches Authorization: Bearer <token> when available.
 */
export async function apiFetch(path, options = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const finalHeaders =
    options.body && !headers['Content-Type']
      ? { ...headers, 'Content-Type': 'application/json' }
      : headers;

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: finalHeaders,
  });
}
