export type TParsedTable = {
  headers: string[];
  rows: string[][];
};

const DEFAULT_TABLE: TParsedTable = {
  headers: ["Column 1", "Column 2"],
  rows: [["", ""]],
};

/** Splits one `| a | b |` row into cell strings, honoring `\|` as an escaped pipe. */
const splitRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (char === "\\" && trimmed[i + 1] === "|") {
      current += "|";
      i++;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
};

const escapeCell = (value: string): string =>
  (value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

const isSeparatorLine = (line: string): boolean =>
  /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line);

/** Parses a GFM markdown table. Returns null if the content isn't a valid table. */
export function parseMarkdownTable(content: string): TParsedTable | null {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return null;
  if (!isSeparatorLine(lines[1])) return null;

  const headers = splitRow(lines[0]);
  const columnCount = headers.length;
  const rows = lines.slice(2).map((line) => {
    const cells = splitRow(line);
    const padded = [...cells];
    while (padded.length < columnCount) padded.push("");
    return padded.slice(0, columnCount);
  });

  return { headers, rows };
}

/** Serializes headers/rows back to a GFM markdown table with padded columns. */
export function serializeMarkdownTable(table: TParsedTable): string {
  const columnCount = table.headers.length;
  const widths = Array.from({ length: columnCount }, (_, col) => {
    const headerWidth = escapeCell(table.headers[col] ?? "").length;
    const cellWidths = table.rows.map((row) => escapeCell(row[col] ?? "").length);
    return Math.max(3, headerWidth, ...cellWidths);
  });

  const formatRow = (cells: string[]) =>
    `| ${cells
      .map((cell, i) => escapeCell(cell ?? "").padEnd(widths[i]))
      .join(" | ")} |`;

  const separator = `| ${widths.map((w) => "-".repeat(w)).join(" | ")} |`;

  const lines = [
    formatRow(table.headers),
    separator,
    ...table.rows.map((row) => formatRow(row)),
  ];
  return lines.join("\n");
}

/** A blank 2-column, 1-row table used when creating a new table node. */
export function createDefaultTable(): TParsedTable {
  return {
    headers: [...DEFAULT_TABLE.headers],
    rows: DEFAULT_TABLE.rows.map((row) => [...row]),
  };
}

export function createDefaultTableMarkdown(): string {
  return serializeMarkdownTable(createDefaultTable());
}
