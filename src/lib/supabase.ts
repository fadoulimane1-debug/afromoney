import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://cdurxhpfaisdvywvxivz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkdXJ4aHBmYWlzZHZ5d3h2aXh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2ODQ0NjYsImV4cCI6MjA5NTI2MDQ2Nn0.DcjnHSrBzhPs_M_aWbiUJI4m1OSrzeqorhXpSAfokOk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
