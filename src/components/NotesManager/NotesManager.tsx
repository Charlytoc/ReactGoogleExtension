import { useEffect, useRef, useState } from "react";
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
import { Select } from "../Select/Select";
// import { useStore } from "../../managers/store"

// function hexToRgba(hex: string, alpha: number) {
//   // Ensure HEX is in the correct format
//   hex = hex.replace(/^#/, "");

//   // Expand shorthand HEX (e.g., "03F" -> "0033FF")
//   if (hex.length === 3) {
//     hex = hex
//       .split("")
//       .map((char) => char + char)
//       .join("");
//   }

//   // Convert HEX to RGB
//   let r = parseInt(hex.substring(0, 2), 16);
//   let g = parseInt(hex.substring(2, 4), 16);
//   let b = parseInt(hex.substring(4, 6), 16);

//   // Ensure alpha is within range
//   alpha = Math.min(1, Math.max(0, alpha));

//   return `rgba(${r}, ${g}, ${b}, ${alpha})`;
// }

export const NotesManager = () => {
  const [notes, setNotes] = useState<TNote[]>([]);
  const allNotesRef = useRef<TNote[]>([]);
  const [filters, setFilters] = useState<{
    archived: "show" | "hide" | "only";
    tags: string[];
    contains: string;
  }>({
    archived: "hide",
    tags: [],
    contains: "",
  });
  // const colorPreferences = useStore((state) => state.colorPreferences);

  const [showFilters, setShowFilters] = useState(false);

  const [tags, setTags] = useState<string[]>([]);

  const { t } = useTranslation();
  const navigate = useNavigate();

  const addNote = async () => {
    const bodyElement = document.body;
    const styles = getComputedStyle(bodyElement);
    const cssVariableValue = styles.getPropertyValue("--bg-color");
    const cssVariableValue2 = styles.getPropertyValue("--bg-color-secondary");

    const defaultNote: TNote = {
      id: generateRandomId("note"),
      title: "",
      content: "",
      color: cssVariableValue,
      createdAt: new Date().toISOString(),
      tags: [],
      archived: false,
      backgroundType: "solid",
      color2: cssVariableValue2,
      imageURL: "",
    };

    setNotes([...allNotesRef.current, defaultNote]);
    await ChromeStorageManager.add("notes", [
      ...allNotesRef.current,
      defaultNote,
    ]);
    cacheLocation(`/notes/${defaultNote.id}`, "/notes");
    navigate(`/notes/${defaultNote.id}`);
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

  const getNotes = async () => {
    const notes: TNote[] = await ChromeStorageManager.get("notes");
    if (notes) {
      allNotesRef.current = notes;
      setNotes(notes);
      let _tags: string[] = Array.from(
        new Set(
          notes
            .flatMap((note) => note.tags ?? [])
            .filter((tag): tag is string => tag !== undefined)
            .filter((tag) => tag.trim() !== "")
        )
      );

      _tags = [...new Set(_tags)];
      setTags(_tags);
    }
  };

  const applyFilters = (notes: TNote[]): TNote[] => {
    let notesToShow = notes;

    if (filters.archived === "hide") {
      notesToShow = notesToShow.filter((note: TNote) => !note.archived);
    }
    if (filters.archived === "only") {
      notesToShow = notesToShow.filter((note: TNote) => note.archived);
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

    if (filters.tags.length > 0) {
      notesToShow = notesToShow.filter((note: TNote) =>
        filters.tags.some((tag) => note.tags?.includes(tag))
      );
    }
    return notesToShow;
  };

  return (
    <Section
      className="bg-gradient"
      headerLeft={<h3 className="font-mono">{t("notes")}</h3>}
      close={() => {
        cacheLocation("/index.html");
        navigate("/index.html");
      }}
      headerRight={
        <>
          <Button
            onClick={addNote}
            className="justify-center padding-5 "
            svg={SVGS.plus}
          />
          <Button
            onClick={() => setShowFilters(!showFilters)}
            className="justify-center padding-5 "
            svg={showFilters ? SVGS.close : SVGS.config}
          />
        </>
      }
    >
      <div className="notes-container">
        <section className="notes-toolbar">
          <LabeledInput
            className="w-100"
            label={t("filter-by-name")}
            placeholder={t("search")}
            type="text"
            name="contains"
            value={filters.contains}
            onChange={(value) => setFilters({ ...filters, contains: value })}
          />
        </section>
        {showFilters && (
          <NoteFilters filters={filters} setFilters={setFilters} tags={tags} />
        )}
        <div className="grid grid-cols-2 gap-10 notes-grid">
          {applyFilters(notes).map((note) => (
            <Note
              {...note}
              id={note.id}
              deleteNote={() => deleteNote(note.id)}
              key={note.id}
            />
          ))}
        </div>
      </div>
    </Section>
  );
};

const NoteFilters = ({
  filters,
  setFilters,
  tags,
}: {
  filters: {
    archived: "show" | "hide" | "only";
    tags: string[];
    contains: string;
  };
  setFilters: (filters: {
    archived: "show" | "hide" | "only";
    tags: string[];
    contains: string;
  }) => void;
  tags: string[];
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex-column gap-5 ">
      <section className="flex-row gap-10 align-center">
        <div className="flex-row gap-10 align-center">
          <Select
            options={[
              { label: t("showArchived"), value: "show" },
              { label: t("hideArchived"), value: "hide" },
              { label: t("onlyArchived"), value: "only" },
            ]}
            defaultValue={filters.archived}
            onChange={(value) =>
              setFilters({
                ...filters,
                archived: value as "show" | "hide" | "only",
              })
            }
            name="archived"
          />
        </div>
      </section>
      {tags.length > 0 && (
        <section className="flex-row gap-10 align-center wrap justify-center">
          {tags.map((tag) => (
            <div
              onClick={() =>
                setFilters({
                  ...filters,
                  tags: filters.tags.includes(tag || "")
                    ? filters.tags.filter((t) => t !== tag)
                    : [...filters.tags, tag || ""],
                })
              }
              key={tag}
              className={`tag ${filters.tags.includes(tag || "") ? "active" : ""
                }`}
            >
              {tag}
            </div>
          ))}
        </section>
      )}
    </div>
  );
};
