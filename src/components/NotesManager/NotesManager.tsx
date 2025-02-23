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
import toast from "react-hot-toast";
import { LabeledInput } from "../LabeledInput/LabeledInput";

const splitInTags = (tags: string, separator: string) => {
  return tags.split(separator);
};

export const NotesManager = () => {
  const [notes, setNotes] = useState<TNote[]>([]);
  const [filters, setFilters] = useState<{
    archived: boolean;
    tags: string[];
    contains: string;
  }>({
    archived: false,
    tags: [],
    contains: "",
  });

  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  const addNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const color = formData.get("color") as string;
    const createdAt = new Date().toISOString();
    const tags = formData.get("tags") as string;
    const archived = formData.get("archived") as string;

    const isArchived = archived === "true";

    const newNote: TNote = {
      id: generateRandomId("note"),
      title,
      content,
      color,
      createdAt,
      tags: splitInTags(tags, ","),
      archived: isArchived,
    };

    e.currentTarget.reset();

    setNotes([...notes, newNote]);

    await ChromeStorageManager.add("notes", [...notes, newNote]);
    setShowForm(false);
  };

  const deleteNote = async (id: string) => {
    const newNotes = notes.filter((note) => note.id !== id);
    setNotes(newNotes);
    await ChromeStorageManager.add("notes", newNotes);
    toast.success(t("noteDeleted"));
  };

  useEffect(() => {
    getNotes();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, notes]);

  const getNotes = async () => {
    const notes = await ChromeStorageManager.get("notes");
    if (notes) {
      setNotes(notes);
    }
  };

  const applyFilters = async () => {
    let notes = await ChromeStorageManager.get("notes");
    let notesToShow = notes;
    if (!filters.archived) {
      notesToShow = notesToShow.filter((note: TNote) => !note.archived);
    }
    if (filters.contains) {
      notesToShow = notesToShow.filter(
        (note: TNote) =>
          note.title
            ?.toLocaleLowerCase()
            .includes(filters.contains.toLocaleLowerCase()) ||
          note.content
            ?.toLocaleLowerCase()
            .includes(filters.contains.toLocaleLowerCase())
      );
    }
    setNotes(notesToShow);
  };

  return (
    <Section
      title={t("notes")}
      close={() => {
        cacheLocation("/index.html");
        navigate("/index.html");
      }}
      extraButtons={
        <Button
          onClick={() => setShowForm(!showForm)}
          className="justify-center padding-5 "
          svg={showForm ? SVGS.close : SVGS.plus}
        />
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
          <div className="flex-row gap-10 align-center">
            <LabeledInput
              label={t("contains")}
              type="text"
              name="contains"
              value={filters.contains}
              onChange={(value) => setFilters({ ...filters, contains: value })}
            />
            <div className="flex-row gap-10 align-center">
              <span>{t("showArchived")}</span>
              <input
                type="checkbox"
                name="archived"
                onChange={(e) =>
                  setFilters({ ...filters, archived: e.target.checked })
                }
              />
            </div>
          </div>
          {notes.map((note) => (
            <Note
              {...note}
              id={note.id}
              deleteNote={() => deleteNote(note.id)}
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
      <div className="flex-row gap-10">
        <span>{t("tags")}</span>
        <input
          type="text"
          name="tags"
          placeholder={t("tags")}
          className="input padding-5 w-100"
        />
      </div>
      <div className="flex-row gap-10">
        <span>{t("archived")}</span>
        <input type="checkbox" name="archived" />
      </div>
      <Button
        type="submit"
        svg={SVGS.check}
        text={t("add")}
        className="w-100 justify-center padding-5 active-on-hover"
      />
    </form>
  );
};
