import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ChromeStorageManager } from "../managers/Storage";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

/** Chrome extension popups don't reliably persist localStorage between openings, so route auth session storage through chrome.storage.local instead. */
const chromeStorageAuthAdapter = {
  getItem: async (key: string) => {
    const value = await ChromeStorageManager.get(key);
    return typeof value === "string" ? value : null;
  },
  setItem: async (key: string, value: string) => {
    await ChromeStorageManager.add(key, value);
  },
  removeItem: async (key: string) => {
    await ChromeStorageManager.delete(key);
  },
};

let cachedClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

/** Returns a memoized client built from the build-time VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY, or null if they weren't set. */
export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  if (!cachedClient) {
    cachedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: chromeStorageAuthAdapter,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return cachedClient;
}
