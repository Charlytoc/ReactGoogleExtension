import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

import { TFormatter } from "../../types";
import { ChromeStorageManager } from "../../managers/Storage";
import { cacheLocation, generateRandomId } from "../../utils/lib";
import { Button } from "../Button/Button";
import { Section } from "../Section/Section";
import { LabeledInput } from "../LabeledInput/LabeledInput";
import { SVGS } from "../../assets/svgs";
import {
  UnstyledButton,
  Text,
  Group,
  Stack,
  ActionIcon,
} from "@mantine/core";
import { IconCheck, IconCode, IconTrash } from "@tabler/icons-react";

export const Formatters = () => {
  const [formatters, setFormatters] = useState<TFormatter[]>([]);
  const [nameFilter, setNameFilter] = useState("");

  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    getFormatters();
  }, []);

  const getFormatters = async () => {
    const stored = await ChromeStorageManager.get("formatters");
    if (stored && Array.isArray(stored)) {
      setFormatters(stored);
    }
  };

  const addFormatter = async () => {
    const bodyElement = document.body;
    const styles = getComputedStyle(bodyElement);
    const cssVariableValue = styles.getPropertyValue("--bg-color");

    const defaultFormatter: TFormatter = {
      id: generateRandomId("formatter"),
      title: "",
      description: "",
      inputs: [
        { id: "input-a", label: "A" },
        { id: "input-b", label: "B" },
      ],
      prompt:
        "Take the inputs and return the formatted string. Always answer with a single string and no explanations.",
      createdAt: new Date().toISOString(),
      category: "",
      color: cssVariableValue,
    };

    const previous = await ChromeStorageManager.get("formatters");
    if (previous && Array.isArray(previous)) {
      await ChromeStorageManager.add("formatters", [...previous, defaultFormatter]);
    } else {
      await ChromeStorageManager.add("formatters", [defaultFormatter]);
    }

    cacheLocation(`/formatters/${defaultFormatter.id}`, "/formatters");
    navigate(`/formatters/${defaultFormatter.id}`);
  };

  const deleteFormatter = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFormatters = formatters.filter((f) => f.id !== id);
    await ChromeStorageManager.add("formatters", newFormatters);
    setFormatters(newFormatters);
    toast.success(t("delete"));
  };

  const filteredFormatters = nameFilter
    ? formatters.filter((f) =>
        f.title.toLowerCase().includes(nameFilter.toLowerCase()) ||
        (f.category || "").toLowerCase().includes(nameFilter.toLowerCase())
      )
    : formatters;

  return (
    <Section
      className="bg-gradient"
      close={() => {
        cacheLocation("/index.html");
        navigate("/index.html");
      }}
      headerLeft={<h3 className="font-mono">{t("formatters")}</h3>}
      headerRight={
        <Button
          className="padding-5"
          onClick={addFormatter}
          svg={SVGS.plus}
          title={t("add")}
        />
      }
    >
      <Stack gap="sm" p="sm">
        <LabeledInput
          className="w-100"
          label={t("filter-by-name")}
          name="name-filter-formatters"
          type="text"
          placeholder={t("search")}
          value={nameFilter}
          onChange={(value) => setNameFilter(value)}
        />

        {filteredFormatters.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl" size="sm">
            {formatters.length === 0
              ? t("no-categories-available")
              : t("no-snapdeals-found")}
          </Text>
        ) : (
          <Stack gap={6}>
            {filteredFormatters.map((formatter) => (
              <FormatterCard
                key={formatter.id}
                formatter={formatter}
                onDelete={deleteFormatter}
                onOpen={() => {
                  cacheLocation(
                    `/formatters/${formatter.id}`,
                    "/formatters"
                  );
                  navigate(`/formatters/${formatter.id}`);
                }}
              />
            ))}
          </Stack>
        )}
      </Stack>
    </Section>
  );
};

const FormatterCard = ({
  formatter,
  onDelete,
  onOpen,
}: {
  formatter: TFormatter;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onOpen: () => void;
}) => {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming) {
      clearTimeout(timerRef.current);
      onDelete(formatter.id, e);
    } else {
      setConfirming(true);
      timerRef.current = setTimeout(() => setConfirming(false), 2500);
    }
  };

  return (
    <UnstyledButton
      onClick={onOpen}
      style={{
        border: "1px solid var(--opaque-gray-color)",
        borderRadius: 8,
        padding: "10px 14px",
        transition: "background-color 0.15s",
      }}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <IconCode
            size={18}
            style={{ flexShrink: 0, opacity: 0.5 }}
          />
          <Text size="sm" fw={500} truncate>
            {formatter.title || "Untitled"}
          </Text>
        </Group>

        <ActionIcon
          variant="subtle"
          color={confirming ? "red" : "gray"}
          size="sm"
          onClick={handleDelete}
        >
          {confirming ? <IconCheck size={15} /> : <IconTrash size={15} />}
        </ActionIcon>
      </Group>
    </UnstyledButton>
  );
};
