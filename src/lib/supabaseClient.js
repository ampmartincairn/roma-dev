import { createClient } from "@supabase/supabase-js";

const FALLBACK_SUPABASE_URL = "https://daauduwrflvserymizzr.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhYXVkdXdyZmx2c2VyeW1penpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4NDQ2NDcsImV4cCI6MjA5MTQyMDY0N30.Th_86mHAglbTu-qNSAQJJo3IH0WPg5cwd7md4x7axgk";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

let supabaseInstance = null;

export const isSupabaseConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env.local"
    );
  }

  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return supabaseInstance;
};
