import { createClient } from '@supabase/supabase-js';

// Values come from environment variables (Vite exposes VITE_-prefixed vars to the client).
// The publishable/anon key is safe to ship in the browser — Row Level Security protects the data.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Fail loudly in dev if env is missing, rather than silently getting auth/query errors later.
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);
