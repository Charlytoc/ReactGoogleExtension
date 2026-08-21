import { ChromeStorageManager } from "../managers/Storage";

const BACKUP_KEYS = [
  "notes",
  "tasks",
  "snapties",
  "formatters",
  "conversations",
  "aiConfig",
  "colorPreferences",
  "openaiApiKey",
  "language",
] as const;

export const BACKUP_FORMAT_VERSION = 1;

export type TBackup = {
  version: number;
  exportedAt: string;
  data: Partial<Record<(typeof BACKUP_KEYS)[number], unknown>>;
};

export async function exportAllData(): Promise<TBackup> {
  const values = await Promise.all(
    BACKUP_KEYS.map((key) => ChromeStorageManager.get(key))
  );

  const data: TBackup["data"] = {};
  BACKUP_KEYS.forEach((key, index) => {
    if (values[index] !== undefined) {
      data[key] = values[index];
    }
  });

  return {
    version: BACKUP_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function downloadBackup(backup: TBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = backup.exportedAt.slice(0, 10);
  link.href = url;
  link.download = `automator-backup-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function parseBackupFile(raw: string): TBackup {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || typeof parsed.data !== "object") {
    throw new Error("Invalid backup file");
  }
  return parsed as TBackup;
}

/** Overwrites every key present in the backup; keys missing from the file are left untouched. */
export async function importAllData(backup: TBackup): Promise<void> {
  const entries = Object.entries(backup.data).filter(([key]) =>
    (BACKUP_KEYS as readonly string[]).includes(key)
  );
  await Promise.all(
    entries.map(([key, value]) => ChromeStorageManager.add(key, value))
  );
}
