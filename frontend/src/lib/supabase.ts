import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://bqohunpakpxgxmfeludn.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxb2h1bnBha3B4Z3htZmVsdWRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyMzcxNDIsImV4cCI6MjA5OTgxMzE0Mn0.oS_Cfo2fg8fc8K29di9PFNvlOiZlD_PPu_8KedisXNw';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
