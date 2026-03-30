import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Allow placeholder values for development without Supabase
const isPlaceholder = supabaseUrl === 'placeholder' || supabaseAnonKey === 'placeholder';

export const supabase = isPlaceholder
  ? null
  : createClient(supabaseUrl, supabaseAnonKey);
