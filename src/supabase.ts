import { createClient } from '@supabase/supabase-js';

// Keys used in localStorage to store Supabase configuration
const STORAGE_URL_KEY = 'kfh_supabase_url';
const STORAGE_KEY_KEY = 'kfh_supabase_anon_key';
const STORAGE_SYNC_ACTIVE = 'kfh_supabase_sync_active';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isActive: boolean;
}

// Fallback credentials if .env file is not present (e.g. when exported to GitHub)
const DEFAULT_SUPABASE_URL = 'https://iwdhnojueubommvsfhmz.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml3ZGhub2p1ZXVib21tdnNmaG16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxMTAxODAsImV4cCI6MjA5NzY4NjE4MH0.dvTEX7FJqusXxAoeKU7s8xFEJeSScneIHFqkoRM6Jwc';

export function getSupabaseConfig(): SupabaseConfig {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const envAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  const url = localStorage.getItem(STORAGE_URL_KEY) || envUrl || '';
  const anonKey = localStorage.getItem(STORAGE_KEY_KEY) || envAnonKey || '';
  
  const storedActive = localStorage.getItem(STORAGE_SYNC_ACTIVE);
  const isActive = storedActive !== null ? storedActive === 'true' : (!!url && !!anonKey);

  return {
    url: url.trim(),
    anonKey: anonKey.trim(),
    isActive
  };
}

export function saveSupabaseConfig(config: { url: string; anonKey: string; isActive: boolean }) {
  localStorage.setItem(STORAGE_URL_KEY, config.url.trim());
  localStorage.setItem(STORAGE_KEY_KEY, config.anonKey.trim());
  localStorage.setItem(STORAGE_SYNC_ACTIVE, config.isActive ? 'true' : 'false');
}

// Lazy initialization of Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseClient() {
  const config = getSupabaseConfig();
  if (!config.url || !config.anonKey) {
    return null;
  }
  
  // Re-create client if config changed or not instantiated yet
  if (!supabaseClient) {
    supabaseClient = createClient(config.url, config.anonKey);
  }
  return supabaseClient;
}

export function resetSupabaseClient() {
  supabaseClient = null;
}

/**
 * Sign in a user with Supabase Email & Password.
 * Strictly sign in only (no sign up).
 */
export async function signInWithSupabase(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) {
    return { 
      data: null, 
      error: new Error('Supabase project URL and Anon Key are missing or unconfigured.') 
    };
  }
  return await client.auth.signInWithPassword({ email: email.trim(), password });
}

/**
 * Sign out current Supabase session.
 */
export async function signOutSupabase() {
  const client = getSupabaseClient();
  if (!client) return { error: null };
  return await client.auth.signOut();
}

/**
 * Retrieve current authenticated Supabase user.
 */
export async function getSupabaseUser() {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getUser();
    return data?.user || null;
  } catch {
    return null;
  }
}

/**
 * Retrieve current Supabase session object.
 */
export async function getSupabaseSession() {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data?.session || null;
  } catch {
    return null;
  }
}

/**
 * SQL command to create the necessary state table in Supabase.
 */
export const SUPABASE_SQL_SETUP = `
-- Create unified state table for King Filter House
CREATE TABLE IF NOT EXISTS kfh_app_state (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE kfh_app_state ENABLE ROW LEVEL SECURITY;

-- Create dynamic public policy (Allow read/write access for easy peer-to-peer setup)
CREATE POLICY "Allow public full read write access" 
ON kfh_app_state 
FOR ALL 
USING (true) 
WITH CHECK (true);
`;

/**
 * Test connectivity and verify if the state table 'kfh_app_state' exists.
 */
export async function testSupabaseConnection(url: string, anonKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const tempClient = createClient(url, anonKey);
    
    // Attempt a simple select inquiry
    const { data, error } = await (tempClient as any)
      .from('kfh_app_state')
      .select('key')
      .limit(1);

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('not found') || error.message.includes('relation "kfh_app_state" does not exist')) {
        return {
          success: true, // Connected but table doesn't exist yet
          message: 'Connected to Supabase! However, the "kfh_app_state" table was not found. Please execute the SQL schema query inside your Supabase SQL Editor.'
        };
      }
      return {
        success: false,
        message: `Connection Error (${error.code}): ${error.message}`
      };
    }

    return {
      success: true,
      message: 'Connection Successful! Supabase is configured and the "kfh_app_state" table is active.'
    };
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || 'Failed to establish cloud handshake'
    };
  }
}

/**
 * Pusher function to write a localStorage key directly into Supabase.
 */
export async function pushKeyToSupabase(key: string, valueJsonStr: string): Promise<boolean> {
  const client = getSupabaseClient();
  const config = getSupabaseConfig();
  if (!client || !config.isActive) return false;

  try {
    let parsedValue: any;
    try {
      parsedValue = JSON.parse(valueJsonStr);
    } catch {
      // Gracefully handle raw non-JSON text values (e.g. unquoted SAKURYFLOW)
      parsedValue = valueJsonStr;
    }
    const { error } = await (client as any)
      .from('kfh_app_state')
      .upsert({
        key: key,
        value: parsedValue,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.error(`[Supabase Push Error for ${key}]:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Supabase Parse/Push Failure for ${key}]:`, err);
    return false;
  }
}

/**
 * Puller function to download a key from Supabase into localStorage.
 */
export async function pullKeyFromSupabase(key: string): Promise<any | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await (client as any)
      .from('kfh_app_state')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (error) {
      console.error(`[Supabase Pull Error for ${key}]:`, error);
      return null;
    }

    return data ? data.value : null;
  } catch (err) {
    console.error(`[Supabase Fetch Failure for ${key}]:`, err);
    return null;
  }
}
