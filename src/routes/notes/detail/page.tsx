import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChromeStorageManager } from "../../../managers/Storage";
import { TNote } from "../../../types";
import { Button } from "../../../components/Button/Button";
import { SVGS } from "../../../assets/svgs";
import { RenderMarkdown } from "../../../components/RenderMarkdown/RenderMarkdown";
import { Textarea } from "../../../components/Textarea/Textarea";
import { useTranslation } from "react-i18next";
import { saveLastPage } from "../../../utils/lib";

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
    const notes = await ChromeStorageManager.get("notes");
    // Use the index to get the note
    const note = notes[id];
    setNote(note);
  };

  const saveNote = async () => {
    const notes = await ChromeStorageManager.get("notes");
    notes[id] = {
      ...note,
      content: note?.content || "",
    };
    await ChromeStorageManager.add("notes", notes);
    setIsEditing(false);
  };

  return (
    <div className=" padding-10">
      <h3 className="flex-row gap-10 justify-between padding-10">
        <Button
          svg={SVGS.back}
          className="padding-5 active-on-hover"
          onClick={() => {
            saveLastPage("/notes");
            navigate("/notes");
          }}
        />{" "}
        {note?.title}
      </h3>
      {isEditing ? (
        <>
          <Textarea
            defaultValue={note?.content || ""}
            onChange={(value) => setNote({ ...note, content: value })}
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
        <>
          <RenderMarkdown markdown={note?.content || ""} />
          <Button
            svg={SVGS.edit}
            text={t("edit")}
            className="w-100 justify-center padding-5 active-on-hover"
            onClick={() => setIsEditing(true)}
          />
        </>
      )}
    </div>
  );
}
