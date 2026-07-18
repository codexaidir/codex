import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Detect if Supabase is properly configured with non-placeholder values
export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseUrl !== 'https://your-supabase-project.supabase.co' &&
  !supabaseUrl.includes('placeholder') &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'your-supabase-anon-public-key' &&
  !supabaseAnonKey.includes('placeholder')
);

// Validate key presence and provide helpful warnings if not set yet.
if (!isSupabaseConfigured) {
  console.warn(
    'Supabase environment variables are missing or placeholders! ' +
    'Running applet in high-fidelity sandbox/demo mode for visual preview. ' +
    'Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env or AI Studio Settings to connect real backend API routes.'
  );
}

// Create and export the Supabase Client
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project-id.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'
);
