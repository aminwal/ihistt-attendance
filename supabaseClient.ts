import { createClient } from '@supabase/supabase-js';

/**
 * Standard environment variable detection.
 * We check both process.env (common in sandboxes) and import.meta.env (Vite standard)
 * to ensure maximum compatibility with different developer environments.
 */

const getEnv = (key: string): string => {
  try {
    // Try process.env first as per coding guidelines
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key] as string;
    }
    // Fallback to import.meta.env if available
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {
    console.warn(`Error accessing environment variable ${key}:`, e);
  }
  return '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnv('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "SUPABASE CONFIGURATION MISSING: Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your Environment Variables (.env file locally or project settings)."
  );
}

// Fallback to placeholder to prevent the entire app from crashing on start if keys are missing
// Note: The app will initialize but DB requests will fail gracefully with 401/404.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);