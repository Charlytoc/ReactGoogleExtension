import { SVGS } from "../../assets/svgs";
import { TNote } from "../../types";
import { Button } from "../Button/Button";
import { ActionIcon, Card, Group, Text } from "@mantine/core";
import "./Note.css";

import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { cacheLocation, buildBackground } from "../../utils/lib";

type TNoteProps = TNote & {
  deleteNote?: () => void;
};

const formatNoteWhen = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const Note = ({
  title,
  deleteNote,
  id,
  tags,
  createdAt,
  updatedAt,
  color = "var(--bg-color)",
  color2 = "var(--bg-color2)",
  backgroundType = "gradient",
  imageURL = "",
  coverImage,
}: TNoteProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const edited = formatNoteWhen(updatedAt);
  const created = formatNoteWhen(createdAt);
  const whenText = edited
    ? t("updatedOn").replace("%s", edited)
    : created
      ? t("createdOn").replace("%s", created)
      : "";
  const visibleTags = (tags ?? []).filter(Boolean);

  return (
    <Card
      style={{
        background: buildBackground(
          color,
          color2,
          backgroundType || "gradient",
          imageURL
        ),
        cursor: "pointer",
        position: "relative",
        padding: 0,
        overflow: "hidden",
      }}
      radius="md"
      p={0}
      onClick={() => {
        cacheLocation(`/notes/${id}`, "/notes");
        navigate(`/notes/${id}`);
      }}
      className="note-card"
    >
      {coverImage ? (
        <img
          src={coverImage}
          alt=""
          className="note-card-cover"
        />
      ) : null}
      <div className="note-card-body">
        <Text fw={600} size="sm" c="white" truncate>
          {title || t("untitled")}
        </Text>
        {whenText || visibleTags.length > 0 ? (
          <div className="note-card-meta">
            {whenText ? <span className="note-card-when">{whenText}</span> : null}
            {visibleTags.map((tag) => (
              <span className="note-card-tag" key={tag}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <Group
          gap={4}
          wrap="nowrap"
          justify="flex-end"
          className="note-card-actions"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            zIndex: 2,
            margin: 0,
            padding: "4px 6px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.45)",
            pointerEvents: "auto",
          }}
        >
          <Button
            className="justify-center padding-5"
            svg={SVGS.trash}
            onClick={deleteNote}
            confirmations={[{ text: t("sure?"), className: "bg-danger" }]}
          />
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => {
              cacheLocation(`/notes/${id}`, "/notes");
              navigate(`/notes/${id}`);
            }}
            aria-label={t("expand")}
            style={{ color: "#fff" }}
          >
            {SVGS.expand}
          </ActionIcon>
        </Group>
    </Card>
  );
};

