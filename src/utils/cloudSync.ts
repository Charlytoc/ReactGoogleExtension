import { getSupabaseClient } from "./supabaseClient";
import { exportAllData, importAllData, type TBackup } from "./backup";

const BACKUPS_TABLE = "notes_ext_backups";

/** Postgres error code for "relation does not exist" — surfaced by PostgREST when the backups table hasn't been created yet. */
const UNDEFINED_TABLE_CODE = "42P01";

export class TableMissingError extends Error {
  constructor() {
    super("The backups table hasn't been created yet");
    this.name = "TableMissingError";
  }
}

export const BACKUPS_TABLE_SETUP_SQL = `create table public.${BACKUPS_TABLE} (
  user_id uuid primary key references auth.users(id) on delete cascade,
  backup jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.${BACKUPS_TABLE} enable row level security;

create policy "Users can read their own backup"
  on public.${BACKUPS_TABLE} for select
  using (auth.uid() = user_id);

create policy "Users can insert their own backup"
  on public.${BACKUPS_TABLE} for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own backup"
  on public.${BACKUPS_TABLE} for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);`;

const throwIfTableMissing = (error: { code?: string } | null): void => {
  if (error?.code === UNDEFINED_TABLE_CODE) {
    throw new TableMissingError();
  }
};

export type TCloudUser = {
  id: string;
  email: string | null;
};

export async function signIn(email: string, password: string): Promise<TCloudUser> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured");

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error("No user returned from Supabase");

  return { id: data.user.id, email: data.user.email ?? null };
}

export async function signUp(email: string, password: string): Promise<TCloudUser> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured");

  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error("No user returned from Supabase");

  return { id: data.user.id, email: data.user.email ?? null };
}

export async function signOut(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.auth.signOut();
}

/**
 * Uses getSession() rather than getUser(): getSession() reads the persisted
 * session from storage and transparently refreshes it if near expiry, all
 * locally. getUser() always makes a network round-trip to validate, which is
 * unreliable here because the extension popup's JS (and any in-flight
 * refresh) is torn down the instant the popup closes.
 */
export async function getCurrentUser(): Promise<TCloudUser | null> {
  const client = getSupabaseClient();
  if (!client) return null;

  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  if (!user) return null;
  return { id: user.id, email: user.email ?? null };
}

export async function uploadBackupToCloud(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured");

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const user = sessionData.session?.user;
  if (sessionError || !user) throw new Error("Not signed in");

  const backup = await exportAllData();
  const { error } = await client.from(BACKUPS_TABLE).upsert(
    {
      user_id: user.id,
      backup,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    throwIfTableMissing(error);
    throw error;
  }
}

export async function downloadBackupFromCloud(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase is not configured");

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  const user = sessionData.session?.user;
  if (sessionError || !user) throw new Error("Not signed in");

  const { data, error } = await client
    .from(BACKUPS_TABLE)
    .select("backup")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    throwIfTableMissing(error);
    throw error;
  }
  if (!data) throw new Error("No cloud backup found for this account");

  await importAllData(data.backup as TBackup);
}
