import { useEffect, useState } from "react";
import "./NotesManager.css";
import { Note } from "../Note/Note";
import { TNote } from "../../types";
import { ChromeStorageManager } from "../../managers/Storage";
import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import { Link } from "react-router";

export const NotesManager = () => {
  const [notes, setNotes] = useState<TNote[]>([]);
  const [showForm, setShowForm] = useState(false);

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
      <h3 className="padding-10 flex-row gap-10 justify-between">
        <Link to="/index.html">
          <Button svg={SVGS.back} />
        </Link>
        <span>Notes Manager</span>
      </h3>

      {showForm ? (
        <NoteForm addNote={addNote} />
      ) : (
        <Button
          text="Add Note"
          svg={SVGS.plus}
          onClick={() => setShowForm(true)}
          className="w-100 justify-center padding-5"
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
  return (
    <form className="flex-column gap-10 padding-10" onSubmit={addNote}>
      <input
        className="input padding-5 w-100"
        name="title"
        type="text"
        placeholder="Note title"
        required
      />
      <input
        className="input padding-5 w-100"
        name="content"
        type="text"
        placeholder="Note content"
      />
      <Button text="Add Note" className="w-100 justify-center padding-5" />
    </form>
  );
};
