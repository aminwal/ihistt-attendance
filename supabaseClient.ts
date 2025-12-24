import { createClient } from '@supabase/supabase-js';

/**
 * Bulletproof environment variable resolution for Supabase.
 * This handles both Vite (import.meta.env) and Node/Sandbox (process.env) environments.
 */

const getSupabaseConfig = () => {
  let url = '';
  let key = '';

  // 1. Try process.env first (Standard for the AI Studio execution environment)
  try {
    if (typeof process !== 'undefined' && process.env) {
      url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
      key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    }
  } catch (e) {
    // process.env not available
  }

  // 2. Try import.meta.env if still missing (Standard for local Vite development)
  if (!url || !key) {
    try {
      // Use type assertion to access Vite-specific env property on import.meta
      if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
        // We use explicit literal access for Vite's static replacement engine
        url = url || (import.meta as any).env.VITE_SUPABASE_URL || '';
        key = key || (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';
      }
    } catch (e) {
      // import.meta.env not available
    }
  }

  return { url, key };
};

const { url: supabaseUrl, key: supabaseAnonKey } = getSupabaseConfig();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "CRITICAL CONFIGURATION ERROR: Supabase credentials not found.\n" +
    "Checklist:\n" +
    "1. Environment Variables must be named: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY\n" +
    "2. If using Vercel, ensure these are added to Project Settings > Environment Variables.\n" +
    "3. YOU MUST REDEPLOY on Vercel after adding variables for them to take effect."
  );
} else {
  console.info("Supabase infrastructure successfully linked.");
}

// Initialize client with placeholders if keys are missing to prevent application crash at boot.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);