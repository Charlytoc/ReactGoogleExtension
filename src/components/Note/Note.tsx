import { SVGS } from "../../assets/svgs";
import { TNote } from "../../types";
import { Button } from "../Button/Button";
import "./Note.css";

import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { generateRandomId, cacheLocation } from "../../utils/lib";
import { ChromeStorageManager } from "../../managers/Storage";
import { notify } from "../../utils/chromeFunctions";
import { Textarea } from "../Textarea/Textarea";
type TNoteProps = TNote & {
  deleteNote?: () => void;
};

export const Note = ({
  title,
  deleteNote,
  id,
  color = "var(--bg-color)",
}: TNoteProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const generateId = async () => {
    notify(t("generatingNoteId"), "info");
    const id = generateRandomId("note");
    const notes = await ChromeStorageManager.get("notes");
    const note = notes.find((note: TNote) => note.title === title);
    if (note) {
      note.id = id;
      await ChromeStorageManager.add("notes", notes);

      notify(t("noteIdGenerated"), "success");
      return note.id;
    }
    notify(t("noteIdNotGenerated"), "error");
    return id;
  };

  return (
    <div
      style={{ backgroundColor: color }}
      className="border-gray padding-10 rounded fit-content"
    >
      <h4>{title}</h4>
      <div className="flex-row gap-10 justify-center ">
        <Button
          className="w-100 justify-center padding-5"
          svg={SVGS.trash}
          text={""}
          onClick={deleteNote}
          confirmations={[{ text: t("sure?"), className: "bg-danger" }]}
        />
        <Button
          className="w-100 justify-center padding-5 active-on-hover"
          svg={SVGS.expand}
          // text={t("expand")}
          onClick={() => {
            cacheLocation(`/notes/${id}`);
            navigate(`/notes/${id}`);
          }}
        />
        {!id && (
          <Button
            className="w-100 justify-center padding-5"
            svg={SVGS.check}
            onClick={() => {
              notify(t("generatingNoteId"), "info");
              generateId();
            }}
          />
        )}
      </div>
    </div>
  );
};

export const NoteEditor = ({
  note,
  setNote,
  close,
}: {
  note: TNote;
  setNote: (note: TNote) => void;
  close: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex-column gap-5">

      <input
        type="text"
        className="w-100  font-size-20 bg-transparent border-none"
        maxLength={40}
        value={note?.title || ""}
        onChange={(e) => setNote({ ...note, title: e.target.value })}
      />
      <Textarea
        maxHeight="75vh"
        defaultValue={note?.content || ""}
        onChange={(value) => setNote({ ...note, content: value })}
      />
      <div className="flex-row gap-5">
        <h3>{t("color")}</h3>
        <input
          type="color"
          value={note?.color || "#09090d"}
          onChange={(e) => setNote({ ...note, color: e.target.value })}
        />
      </div>
      <div className="flex-row gap-5">
        <h3>{t("tags")}</h3>
        <input
          type="text"
          value={note?.tags?.join(",") || ""}
          onChange={(e) =>
            setNote({ ...note, tags: e.target.value.split(",") })
          }
        />
      </div>
      <div className="flex-row gap-5">
        <h3>{t("archived")}</h3>
        <input
          type="checkbox"
          checked={note?.archived}
          onChange={(e) => setNote({ ...note, archived: e.target.checked })}
        />
      </div>

      <Button
        svg={SVGS.check}
        text={""}
        className="w-100 justify-center padding-5 active-on-hover border-gray"
        onClick={() => {
          close();
        }}
      />
    </div>
  );
};
