import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { cacheLocation } from "../../utils/lib";
import { ChromeStorageManager } from "../../managers/Storage";
import {
  migrateFormatter,
  migrateNote,
  migrateSnaptie,
  migrateTask,
  noteMatchesTextFilter,
  taskMatchesTextFilter,
  snaptieMatchesTextFilter,
  formatterMatchesNameFilter,
} from "../../utils/tags";
import type { TFormatter, TNote, TSnaptie, TTask } from "../../types";
import useDebounce from "../../hooks/useDebounce";
import {
  UnstyledButton,
  Text,
  Stack,
  SimpleGrid,
  Divider,
  Group,
  TextInput,
  ActionIcon,
} from "@mantine/core";
import {
  IconMessageCircle,
  IconCode,
  IconScissors,
  IconNote,
  IconListCheck,
  IconSearch,
  IconX,
} from "@tabler/icons-react";
import "./Content.css";

type NavItem = {
  label: string;
  icon: React.ReactNode;
  path: string;
};

type SearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  path: string;
};

const MAX_RESULTS_PER_TYPE = 5;

export const Content = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const go = (path: string) => {
    cacheLocation(path);
    navigate(path);
  };

  const runSearch = useDebounce(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults(null);
      setSearching(false);
      return;
    }

    const [notesRaw, tasksRaw, snaptiesRaw, formattersRaw] = await Promise.all([
      ChromeStorageManager.get("notes"),
      ChromeStorageManager.get("tasks"),
      ChromeStorageManager.get("snapties"),
      ChromeStorageManager.get("formatters"),
    ]);

    const notes: TNote[] = Array.isArray(notesRaw)
      ? notesRaw.map(migrateNote)
      : [];
    const tasks: TTask[] = Array.isArray(tasksRaw) ? tasksRaw.map(migrateTask) : [];
    const snapties: TSnaptie[] = Array.isArray(snaptiesRaw)
      ? snaptiesRaw.map(migrateSnaptie)
      : [];
    const formatters: TFormatter[] = Array.isArray(formattersRaw)
      ? formattersRaw.map(migrateFormatter)
      : [];

    const noteResults: SearchResult[] = notes
      .filter((n) => noteMatchesTextFilter(n, trimmed))
      .slice(0, MAX_RESULTS_PER_TYPE)
      .map((n) => ({
        id: n.id,
        title: n.title || t("untitled"),
        subtitle: t("note"),
        icon: <IconNote size={16} />,
        path: `/notes/${n.id}`,
      }));

    const taskResults: SearchResult[] = tasks
      .filter((tsk) => taskMatchesTextFilter(tsk, trimmed))
      .slice(0, MAX_RESULTS_PER_TYPE)
      .map((tsk) => ({
        id: tsk.id,
        title: tsk.title || t("untitled"),
        subtitle: t("task"),
        icon: <IconListCheck size={16} />,
        path: `/tasks/${tsk.id}`,
      }));

    const snaptieResults: SearchResult[] = snapties
      .filter((s) => snaptieMatchesTextFilter(s, trimmed))
      .slice(0, MAX_RESULTS_PER_TYPE)
      .map((s) => ({
        id: s.id,
        title: s.title || t("untitled"),
        subtitle: t("snippets"),
        icon: <IconScissors size={16} />,
        path: `/snapties/${s.id}`,
      }));

    const formatterResults: SearchResult[] = formatters
      .filter((f) => formatterMatchesNameFilter(f, trimmed))
      .slice(0, MAX_RESULTS_PER_TYPE)
      .map((f) => ({
        id: f.id,
        title: f.title || t("untitled"),
        subtitle: t("formatters"),
        icon: <IconCode size={16} />,
        path: `/formatters/${f.id}`,
      }));

    setResults([...noteResults, ...taskResults, ...snaptieResults, ...formatterResults]);
    setSearching(false);
  }, 250);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    runSearch(value);
  };

  const clearSearch = () => {
    setQuery("");
    setResults(null);
    setSearching(false);
  };

  const isSearchActive = query.trim().length > 0;

  const tools: NavItem[] = useMemo(
    () => [
      { label: t("formatters"), icon: <IconCode size={22} />, path: "/formatters" },
      { label: t("snippets"), icon: <IconScissors size={22} />, path: "/snapties" },
      { label: t("notes"), icon: <IconNote size={22} />, path: "/notes" },
      { label: t("tasks"), icon: <IconListCheck size={22} />, path: "/tasks" },
    ],
    [t]
  );

  return (
    <Stack gap="md" p="md" className="content-home">
      <TextInput
        placeholder={t("search")}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        leftSection={<IconSearch size={16} />}
        rightSection={
          query ? (
            <ActionIcon variant="subtle" color="gray" onClick={clearSearch}>
              <IconX size={14} />
            </ActionIcon>
          ) : null
        }
      />

      {isSearchActive ? (
        <Stack gap={4} className="search-results">
          {searching && (
            <Text size="sm" c="dimmed">
              {t("search")}...
            </Text>
          )}
          {!searching && results && results.length === 0 && (
            <Text size="sm" c="dimmed">
              {t("no-snapdeals-found")}
            </Text>
          )}
          {!searching &&
            results?.map((r) => (
              <UnstyledButton
                key={`${r.path}`}
                className="nav-card search-result"
                onClick={() => go(r.path)}
              >
                <Group gap="sm" wrap="nowrap">
                  {r.icon}
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate>
                      {r.title}
                    </Text>
                    {r.subtitle && (
                      <Text size="xs" c="dimmed">
                        {r.subtitle}
                      </Text>
                    )}
                  </Stack>
                </Group>
              </UnstyledButton>
            ))}
        </Stack>
      ) : (
        <>
          {/* Hero — Chat */}
          <UnstyledButton
            className="nav-card nav-card--hero"
            onClick={() => go("/chat")}
          >
            <Group gap="sm" justify="center">
              <IconMessageCircle size={24} />
              <Text fw={600} size="lg">
                {t("chat")}
              </Text>
            </Group>
          </UnstyledButton>

          {/* Divider */}
          <Divider
            label={
              <Text size="xs" c="dimmed" tt="uppercase" fw={500} lts={1}>
                {t("tools")}
              </Text>
            }
            labelPosition="center"
          />

          {/* Tool grid — 2 columns */}
          <SimpleGrid cols={2} spacing="sm">
            {tools.map((item) => (
              <UnstyledButton
                key={item.path}
                className="nav-card"
                onClick={() => go(item.path)}
              >
                <Stack align="center" gap={6}>
                  {item.icon}
                  <Text size="sm" fw={500}>
                    {item.label}
                  </Text>
                </Stack>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
};
