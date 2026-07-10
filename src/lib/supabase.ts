import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Advertencia: Las variables de entorno de Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) no están definidas.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
