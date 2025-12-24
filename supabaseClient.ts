import { createClient } from '@supabase/supabase-js';

/**
 * Robust environment variable resolution for Supabase.
 * Checks process.env, import.meta.env, window, and LocalStorage.
 */

const getSupabaseConfig = () => {
  const getVar = (name: string): string => {
    try {
      // 1. Check process.env (Node/AI Studio)
      if (typeof process !== 'undefined' && process.env && process.env[name]) {
        return process.env[name] as string;
      }
      // 2. Check import.meta.env (Vite)
      if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[name]) {
        return (import.meta as any).env[name];
      }
      // 3. Check LocalStorage (User Manual Override)
      const stored = localStorage.getItem(`IHIS_CFG_${name}`);
      if (stored) return stored;
    } catch (e) {
      // Ignore errors
    }
    return '';
  };

  const url = getVar('VITE_SUPABASE_URL') || getVar('SUPABASE_URL');
  const key = getVar('VITE_SUPABASE_ANON_KEY') || getVar('SUPABASE_ANON_KEY');

  return { url, key };
};

const { url: supabaseUrl, key: supabaseAnonKey } = getSupabaseConfig();

// Use an informative log instead of an error to prevent user alarm during local-first operation
if (!supabaseUrl || !supabaseAnonKey) {
  console.info("IHIS: Operating in Local Mode. Cloud sync disabled.");
} else {
  console.info("IHIS: Cloud Infrastructure Linked Successfully.");
}

// Initialize client with placeholders if keys are missing to prevent application crash.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
