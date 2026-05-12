import type { TFormatter, TNote, TSnaptie, TTask } from "../types";

export function normalizeTag(s: string): string {
  return s.trim();
}

/**
 * Parse a comma-separated tags string into unique normalized tags (order preserved).
 */
export function parseTagsInput(value: string): string[] {
  const parts = value.split(",");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    const tag = normalizeTag(p);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export function collectAllTags(payload: {
  notes?: TNote[];
  tasks?: TTask[];
  snapties?: TSnaptie[];
  formatters?: TFormatter[];
}): string[] {
  const set = new Set<string>();
  const addAll = (arr?: string[]) => {
    for (const t of arr ?? []) {
      const n = normalizeTag(t);
      if (n) set.add(n);
    }
  };
  for (const n of payload.notes ?? []) addAll(n.tags);
  for (const t of payload.tasks ?? []) addAll(t.tags);
  for (const s of payload.snapties ?? []) addAll(s.tags);
  for (const f of payload.formatters ?? []) addAll(f.tags);
  return [...set].sort((a, b) => a.localeCompare(b));
}

type LegacyRecord = Record<string, unknown>;

export function migrateSnaptie(raw: unknown): TSnaptie {
  const o = raw as LegacyRecord;
  const id = String(o.id ?? "");
  const title = String(o.title ?? "");
  const content = String(o.content ?? "");
  const createdAt = String(o.createdAt ?? new Date().toISOString());
  const isUrl = Boolean(o.isUrl);
  const color = String(o.color ?? "#09090d");
  const pinned = o.pinned === true ? true : undefined;

  let tags = Array.isArray(o.tags)
    ? (o.tags as unknown[])
        .map((x) => normalizeTag(String(x)))
        .filter((x) => x !== "")
    : [];
  const legacyCat = o.category != null ? normalizeTag(String(o.category)) : "";
  if (tags.length === 0 && legacyCat) {
    tags = [legacyCat];
  }

  return {
    id,
    title,
    content,
    createdAt,
    isUrl,
    color,
    pinned,
    tags,
  };
}

export function migrateFormatter(raw: unknown): TFormatter {
  const o = raw as LegacyRecord;
  const id = String(o.id ?? "");
  const title = String(o.title ?? "");
  const description =
    o.description != null && typeof o.description === "string"
      ? o.description
      : undefined;
  const inputs = Array.isArray(o.inputs) ? (o.inputs as TFormatter["inputs"]) : [];
  const prompt = String(o.prompt ?? "");
  const createdAt = String(o.createdAt ?? new Date().toISOString());
  const updatedAt =
    o.updatedAt != null && typeof o.updatedAt === "string" ? o.updatedAt : undefined;
  const color =
    o.color != null && typeof o.color === "string" ? o.color : undefined;

  let tags = Array.isArray(o.tags)
    ? (o.tags as unknown[])
        .map((x) => normalizeTag(String(x)))
        .filter((x) => x !== "")
    : [];
  const legacyCat = o.category != null ? normalizeTag(String(o.category)) : "";
  if (tags.length === 0 && legacyCat) {
    tags = [legacyCat];
  }

  return {
    id,
    title,
    description,
    inputs,
    prompt,
    createdAt,
    updatedAt,
    color,
    tags,
  };
}

export function migrateTask(raw: unknown): TTask {
  const o = raw as LegacyRecord;
  const tags = Array.isArray(o.tags)
    ? (o.tags as unknown[])
        .map((x) => normalizeTag(String(x)))
        .filter((x) => x !== "")
    : undefined;

  return {
    id: String(o.id ?? ""),
    title: String(o.title ?? ""),
    description:
      o.description != null && typeof o.description === "string"
        ? o.description
        : undefined,
    status: (o.status as TTask["status"]) ?? "TODO",
    createdAt:
      o.createdAt != null && typeof o.createdAt === "string" ? o.createdAt : undefined,
    startDatetime:
      o.startDatetime != null && typeof o.startDatetime === "string"
        ? o.startDatetime
        : undefined,
    dueDatetime:
      o.dueDatetime != null && typeof o.dueDatetime === "string"
        ? o.dueDatetime
        : undefined,
    reminderEvery:
      typeof o.reminderEvery === "number" ? o.reminderEvery : undefined,
    motivationText:
      o.motivationText != null && typeof o.motivationText === "string"
        ? o.motivationText
        : undefined,
    estimatedTime:
      typeof o.estimatedTime === "number" ? o.estimatedTime : undefined,
    estimatedTimeUnit:
      o.estimatedTimeUnit != null && typeof o.estimatedTimeUnit === "string"
        ? o.estimatedTimeUnit
        : undefined,
    lastReminderAt:
      o.lastReminderAt != null && typeof o.lastReminderAt === "string"
        ? o.lastReminderAt
        : undefined,
    priority: (o.priority as TTask["priority"]) ?? "low",
    tags,
  };
}

export function snaptieMatchesTextFilter(snaptie: TSnaptie, q: string): boolean {
  const lower = q.toLowerCase();
  const titleIncludes = snaptie.title.toLowerCase().includes(lower);
  const contentIncludes = snaptie.content.toLowerCase().includes(lower);
  const tagIncludes = (snaptie.tags ?? []).some((tag) =>
    tag.toLowerCase().includes(lower)
  );
  return titleIncludes || contentIncludes || tagIncludes;
}

/**
 * Group snapties by tag label. Snapties with no tags go under `uncategorizedLabel` once.
 * A snaptie with multiple tags appears in multiple buckets.
 */
export function bucketSnaptiesByTag(
  snapties: TSnaptie[],
  uncategorizedLabel: string
): Record<string, TSnaptie[]> {
  const acc: Record<string, TSnaptie[]> = {};
  for (const snaptie of snapties) {
    const rawTags = (snaptie.tags ?? []).map(normalizeTag).filter(Boolean);
    if (rawTags.length === 0) {
      if (!acc[uncategorizedLabel]) acc[uncategorizedLabel] = [];
      acc[uncategorizedLabel].push(snaptie);
      continue;
    }
    const seenBucket = new Set<string>();
    for (const tag of rawTags) {
      if (seenBucket.has(tag)) continue;
      seenBucket.add(tag);
      if (!acc[tag]) acc[tag] = [];
      acc[tag].push(snaptie);
    }
  }
  return acc;
}

export function formatterMatchesNameFilter(
  formatter: TFormatter,
  nameFilter: string
): boolean {
  const lower = nameFilter.toLowerCase();
  if (formatter.title.toLowerCase().includes(lower)) return true;
  return (formatter.tags ?? []).some((tag) => tag.toLowerCase().includes(lower));
}
