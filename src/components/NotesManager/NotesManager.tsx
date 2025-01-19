import { useEffect, useState } from "react";
import "./NotesManager.css";
import { Note } from "../Note/Note";
import { TNote } from "../../types";
import { ChromeStorageManager } from "../../managers/Storage";
import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { generateRandomId, cacheLocation } from "../../utils/lib";
import { Section } from "../Section/Section";

export const NotesManager = () => {
  const [notes, setNotes] = useState<TNote[]>([]);
  const [showForm, setShowForm] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();

  const addNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const color = formData.get("color") as string;
    const createdAt = new Date().toISOString();

    const newNote: TNote = { title, content, color, createdAt };

    newNote.id = generateRandomId("note");

    e.currentTarget.reset();

    setNotes([...notes, newNote]);

    await ChromeStorageManager.add("notes", [...notes, newNote]);
    setShowForm(false);
  };

  const deleteNote = async (index: number) => {
    const newNotes = notes.filter((_, i) => i !== index);
    setNotes(newNotes);
    await ChromeStorageManager.add("notes", newNotes);
  };

  useEffect(() => {
    getNotes();
  }, []);

  const getNotes = async () => {
    const notes = await ChromeStorageManager.get("notes");
    if (notes) {
      setNotes(notes);
    }
  };

  return (
    <Section
      title={t("notes")}
      close={() => {
        cacheLocation("/index.html");
        navigate("/index.html");
      }}
      extraButtons={
        <>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="justify-center padding-5 "
            svg={showForm ? SVGS.close : SVGS.plus}
          />
        </>
      }
    >
      {showForm ? (
        <NoteForm
          addNote={addNote}
          usedColors={[
            ...new Set(
              notes
                .map((note) => note.color)
                .filter((color) => color !== undefined)
            ),
          ]}
        />
      ) : (
        <div className="notes-container">
          {notes.map((note, index) => (
            <Note
              {...note}
              id={note.id}
              deleteNote={() => deleteNote(index)}
              key={note.id}
            />
          ))}
        </div>
      )}
    </Section>
  );
};

const NoteForm = ({
  addNote,
  usedColors,
}: {
  addNote: (e: React.FormEvent<HTMLFormElement>) => void;
  usedColors: string[];
}) => {
  const { t } = useTranslation();

  const [color, setColor] = useState("#09090d");
  return (
    <form
      className="flex-column gap-10 padding-10 border-gray rounded"
      onSubmit={addNote}
    >
      <input
        className="input padding-5 w-100"
        name="title"
        maxLength={40}
        type="text"
        placeholder={t("title")}
        required
      />
      <input
        className="input padding-5 w-100"
        name="content"
        type="text"
        placeholder={t("content")}
      />
      <div className="flex-row gap-10 padding-5">
        <span>{t("colorOfNote")}</span>
        <input
          type="color"
          name="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>
      {usedColors.length > 0 && (
        <div className="flex-row gap-10">
          {usedColors.map((color) => (
            <div
              key={color}
              className="color-preview pointer"
              style={{ backgroundColor: color }}
              onClick={() => setColor(color)}
            ></div>
          ))}
        </div>
      )}
      <Button
        type="submit"
        svg={SVGS.check}
        text={t("add")}
        className="w-100 justify-center padding-5 active-on-hover"
      />
    </form>
  );
};
