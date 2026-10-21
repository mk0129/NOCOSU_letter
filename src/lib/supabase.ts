import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 家族の輪のサーバー（Supabase）。公開用キーなのでここに置いてよい（RLSで守る）。
// 空なら家族の輪の機能は表示だけ出して「準備中」にする。
export const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://rzjhfhjaxioqnxzkrltp.supabase.co';
export const SUPABASE_KEY: string = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) || 'sb_publishable_30Vpk5W5fi2uOmOzzsrUzw_L9bizy76';

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;
