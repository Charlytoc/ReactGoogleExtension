import { useEffect, useState } from "react";
import "./NotesManager.css";
import { Note } from "../Note/Note";
import { TNote } from "../../types";
import { ChromeStorageManager } from "../../managers/Storage";
import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { saveLastPage } from "../../utils/lib";

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
    const newNote: TNote = { title, content };
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
    <div className="padding-10 flex-column gap-10">
      <h3 className=" flex-row gap-10 justify-between">
        <Button
          svg={SVGS.back}
          className="padding-5 active-on-hover"
          onClick={() => {
            saveLastPage("/index.html");
            navigate("/index.html");
          }}
        />
        <span>{t("notes")}</span>
      </h3>

      {showForm ? (
        <NoteForm addNote={addNote} />
      ) : (
        <Button
          text={t("addNote")}
          svg={SVGS.plus}
          onClick={() => setShowForm(true)}
          className="w-100 justify-center padding-5 active-on-hover border-gray"
        />
      )}

      <div className="flex-column gap-10">
        {notes.map((note, index) => (
          <Note
            deleteNote={() => deleteNote(index)}
            key={`${index}-${note.title}`}
            title={note.title}
            content={note.content}
            id={index.toString()}
          />
        ))}
      </div>
    </div>
  );
};

const NoteForm = ({
  addNote,
}: {
  addNote: (e: React.FormEvent<HTMLFormElement>) => void;
}) => {
  const { t } = useTranslation();
  return (
    <form
      className="flex-column gap-10 padding-10 border-gray rounded"
      onSubmit={addNote}
    >
      <input
        className="input padding-5 w-100"
        name="title"
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
      <Button
        svg={SVGS.check}
        text={t("add")}
        className="w-100 justify-center padding-5 active-on-hover"
      />
    </form>
  );
};
