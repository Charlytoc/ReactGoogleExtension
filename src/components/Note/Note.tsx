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

export const Note = ({
  title,
  deleteNote,
  id,
  color = "var(--bg-color)",
  color2 = "var(--bg-color2)",
  backgroundType = "gradient",
  imageURL = "",
  coverImage,
}: TNoteProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

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
      <div
        style={{
          position: "relative",
          ...(coverImage ? { height: 100 } : { minHeight: 48 }),
        }}
      >
        {coverImage ? (
          <>
            <div style={{ height: "100%", overflow: "hidden" }}>
              <img
                src={coverImage}
                alt="cover"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                  display: "block",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)",
                display: "flex",
                alignItems: "flex-end",
                padding: "8px 12px",
                paddingRight: 72,
                pointerEvents: "none",
              }}
            >
              <Text fw={600} size="sm" c="white" truncate style={{ width: "100%" }}>
                {title || t("untitled")}
              </Text>
            </div>
          </>
        ) : (
          <div
            style={{
              padding: "12px 72px 12px 12px",
              minHeight: 48,
              display: "flex",
              alignItems: "center",
            }}
          >
            <Text fw={600} size="sm" c="white" truncate style={{ width: "100%" }}>
              {title || t("untitled")}
            </Text>
          </div>
        )}
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
      </div>
    </Card>
  );
};

