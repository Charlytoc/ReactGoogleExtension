import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChromeStorageManager } from "../../../managers/Storage";
import { TNote } from "../../../types";
import { Button } from "../../../components/Button/Button";
import { SVGS } from "../../../assets/svgs";
import { Textarea } from "../../../components/Textarea/Textarea";
import { useTranslation } from "react-i18next";
import { cacheLocation } from "../../../utils/lib";
import { StyledMarkdown } from "../../../components/RenderMarkdown/StyledMarkdown";
import { Section } from "../../../components/Section/Section";

export default function NoteDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [notes, setNotes] = useState<TNote[]>([]);
  if (!id) return <div>No id</div>;
  const [note, setNote] = useState<TNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getNote();
  }, [id]);

  useEffect(() => {
    if (note) {
      saveNote();
    }
  }, [note]);

  const getNote = async () => {
    const notes: TNote[] = await ChromeStorageManager.get("notes");
    // Use the index to get the note
    const note = notes.find((note) => note.id === id);
    if (!note) {
      cacheLocation("/notes");
      navigate("/notes");
    } else {
      setNote(note);
      setNotes(notes);
    }
  };

  const saveNote = async () => {
    // let notes = await ChromeStorageManager.get("notes");
    let newNotes = [...notes];
    if (!note) return;

    if (!newNotes) {
      newNotes = [note];
    } else {
      newNotes = newNotes.map((n: TNote) => {
        if (n.id === id) {
          return { ...n, ...note };
        }
        return n;
      });
    }

    await ChromeStorageManager.add("notes", newNotes);
  };

  return (
    <div className=" padding-10">
      {isEditing ? (
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
              setIsEditing(false);
            }}
          />
        </div>
      ) : (
        <Section
          close={() => {
            cacheLocation("/notes");
            navigate("/notes");
          }}
          title={note?.title || ""}
          extraButtons={
            <Button
              svg={SVGS.edit}
              title={t("edit")}
              className="w-100 justify-center padding-5 "
              onClick={() => setIsEditing(true)}
            />
          }
        >
          <div className="flex-row gap-5 text-mini align-center justify-center">
            {note?.tags?.map((tag) => (
              <span key={tag} className="bg-gray padding-5 rounded">
                #{tag}
              </span>
            ))}
          </div>
          <hr className="separator" />
          <StyledMarkdown markdown={note?.content || ""} />
        </Section>

      )}
    </div>
  );
}
