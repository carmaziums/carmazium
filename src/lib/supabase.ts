import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qcqnllehtuczgammazwi.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcW5sbGVodHVjemdhbW1hendpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MDUxODcsImV4cCI6MjA4NTI4MTE4N30.G9TwDGnIAI7KNgpwvYTl-sJd9UISRGU3XeIHckuoHJE';

// This is a safe client even if environment variables are missing on Vercel
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
