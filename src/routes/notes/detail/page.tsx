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
import { toast } from "react-hot-toast";
import { Section } from "../../../components/Section/Section";

export default function NoteDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  if (!id) return <div>No id</div>;
  const [note, setNote] = useState<TNote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getNote();
  }, [id]);

  const getNote = async () => {
    const notes: TNote[] = await ChromeStorageManager.get("notes");
    // Use the index to get the note
    const note = notes.find((note) => note.id === id);
    if (!note) {
      cacheLocation("/notes");
      navigate("/notes");
    } else {
      setNote(note);
    }
  };

  const saveNote = async () => {
    let notes = await ChromeStorageManager.get("notes");
    if (!notes) {
      notes = [note];
    } else {
      notes = notes.map((n: TNote) => {
        if (n.id === id) {
          return { ...n, ...note };
        }
        return n;
      });
    }

    await ChromeStorageManager.add("notes", notes);
    setIsEditing(false);
    toast.success(t("note-saved"));
  };

  return (
    <div className=" padding-10">
      {isEditing ? (
        <>
          <input
            type="text"
            className="input w-100 padding-5"
            maxLength={40}
            value={note?.title || ""}
            onChange={(e) => setNote({ ...note, title: e.target.value })}
          />
          <Textarea
            defaultValue={note?.content || ""}
            onChange={(value) => setNote({ ...note, content: value })}
          />
          <input
            type="color"
            value={note?.color || "#09090d"}
            onChange={(e) => setNote({ ...note, color: e.target.value })}
          />
          <Button
            svg={SVGS.check}
            text={""}
            className="w-100 justify-center padding-5 active-on-hover"
            onClick={() => {
              saveNote();
            }}
          />
        </>
      ) : (
        <Section
          close={() => {
            cacheLocation("/notes");
            navigate("/notes");
          }}
          title={note?.title || ""}
        >
          <StyledMarkdown markdown={note?.content || ""} />
          <Button
            svg={SVGS.edit}
            text={t("edit")}
            className="w-100 justify-center padding-5 active-on-hover"
            onClick={() => setIsEditing(true)}
          />
        </Section>
      )}
    </div>
  );
}
