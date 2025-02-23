import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChromeStorageManager } from "../../../managers/Storage";
import { TNote } from "../../../types";
import { Button } from "../../../components/Button/Button";
import { SVGS } from "../../../assets/svgs";
import { useTranslation } from "react-i18next";
import { cacheLocation } from "../../../utils/lib";
import { StyledMarkdown } from "../../../components/RenderMarkdown/StyledMarkdown";
import { Section } from "../../../components/Section/Section";
import { NoteEditor } from "../../../components/Note/Note";

export default function NoteDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [notes, setNotes] = useState<TNote[]>([]);
  if (!id) return <div>No id</div>;
  const [note, setNote] = useState<TNote>({
    id: id,
    title: "",
    content: "",
    color: "var(--bg-color)",
    tags: [],
    archived: false,
  });
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
        <Section
          close={async () => {
            const prevPage = await ChromeStorageManager.get("prevPage");
            cacheLocation(prevPage, "lastPage");
            navigate(prevPage);
          }}
          title={note?.title || ""}
        >
          <NoteEditor
            note={note}
            setNote={setNote}
            close={() => {
              setIsEditing(false);
            }}
          />
        </Section>
      ) : (
        <Section
          close={async () => {
            const prevPage = await ChromeStorageManager.get("prevPage");
            cacheLocation(prevPage, "lastPage");
            navigate(prevPage);
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
          {/* <div className="flex-row gap-5 text-mini align-center justify-center">
            {note?.tags?.map((tag) => (
              <span key={tag} className="bg-gray padding-5 rounded">
                #{tag}
              </span>
            ))}
          </div> */}
          <hr className="separator" />
          <StyledMarkdown markdown={note?.content || ""} />
        </Section>
      )}
    </div>
  );
}
