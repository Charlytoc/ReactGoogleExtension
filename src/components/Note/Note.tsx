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
import { LabeledInput } from "../LabeledInput/LabeledInput";
import { CommandPalette, TCommand } from "../CommandPalette/CommandPalette";

import { useEffect, useRef, useState } from "react";
import { createCompletion } from "../../utils/ai";
import toast from "react-hot-toast";
import { useStore } from "../../managers/store";
import { useShallow } from "zustand/shallow";

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
      className="padding-10 rounded w-100"
    >
      <h4>{title?.slice(0, 20) || t("untitled")}</h4>
      <div className="flex-row gap-10 justify-center ">
        <Button
          className="w-100 justify-center padding-5"
          svg={SVGS.trash}
          text={""}
          onClick={deleteNote}
          confirmations={[{ text: t("sure?"), className: "bg-danger" }]}
        />
        <Button
          className="w-100 justify-center padding-5 contrast-on-hover"
          svg={SVGS.expand}
          // text={t("expand")}
          onClick={() => {
            cacheLocation(`/notes/${id}`, "/notes");
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

const getColorFromString = (color: string) => {
  const regex = /^#([0-9a-fA-F]{6})$/;
  // Search fro a color in a text. If found, return the color.
  const match = color.match(regex);
  if (match) {
    return match[0];
  }
  return null;
};

const COMMAND_PALETTE_PATTERN = /\/\s/;

const containsCommand = (text: string) => {
  return COMMAND_PALETTE_PATTERN.test(text);
};

export const NoteEditor = ({
  note,
  setNote,
}: // close,
// close,
{
  note: TNote;
  setNote: (note: TNote) => void;
  close: () => void;
}) => {
  const apiKeyref = useRef("");
  const [commandPaletteOpened, setCommandPaletteOpened] = useState(false);
  const { t } = useTranslation();
  const config = useStore(useShallow((state) => state.config));

  const generateColor = async () => {
    if (!apiKeyref.current) {
      toast.error(t("noApiKey"));
      return;
    }
    const systemPrompt = `
    <CHARACTER>
    You are a color generator.
    You will be given a prompt and you will need to generate a color.
    The color return only a # followed by 6 characters.
    </CHARACTER>
    <RESPONSE>  
    Your response should be exactly 7 characters long. Starting with # and followed by 6 characters.
    </RESPONSE>
    <EXAMPLES>
    #000000
    #ffffff
    #000000
    #ffffff
    </EXAMPLES>
    <CONTEXT>
    You are inside a note editor from a notetaker app.
    The color should be a valid color.
    The color should be related to the the information of the note.

    This is an small context about the note:
    TITLE: "${note.title}"
    CONTENT: """
    ${note.content}
    """
    TAGS: "${note.tags?.join(",")}"
    ARCHIVED: "${note.archived}"

    THEME: 
    """
    ${JSON.stringify(config.theme.themePreferences)}
    """
    </CONTEXT>
    `;
    await createCompletion(
      {
        messages: [{ role: "system", content: systemPrompt }],
        model: "gpt-4o-mini",
        temperature: 0.9,
        max_completion_tokens: 100,
        response_format: { type: "text" },
        apiKey: apiKeyref.current,
      },
      (completion) => {
        const response = completion.choices[0].message.content;
        if (!response) return;
        const color = getColorFromString(response);
        if (color) {
          setNote({ ...note, color });
        }
      }
    );
  };

  useEffect(() => {
    const getApiKey = async () => {
      const storedApiKey = await ChromeStorageManager.get("openaiApiKey");
      apiKeyref.current = storedApiKey;
    };
    getApiKey();
  }, []);

  const commands: TCommand[] = [
    {
      description: t("generateColorDescription"),
      node: (
        <Button
          text={t("generateColorWithAI")}
          // usesAI={true}
          svg={SVGS.generate}
          title={t("generateColorDescription")}
          onClick={() => {
            generateColor();
          }}
        />
      ),
    },
  ];

  return (
    <div className="flex-column gap-5">
      {commandPaletteOpened && <CommandPalette commands={commands} />}
      <LabeledInput
        label={t("title")}
        type="text"
        name="title"
        getAIContext={() => `Generate a title for a note.
        The title should be related to the note.
        This is the content of the note:
        ${note?.content || ""}

        This are the current tags of the note:
        ${note?.tags?.join(",") || ""}
        `}
        aiButton={true}
        value={note?.title || ""}
        onChange={(value) => setNote({ ...note, title: value })}
      />
      <Textarea
        maxHeight="75vh"
        defaultValue={note?.content || ""}
        onChange={(value) => {
          if (containsCommand(value)) {
            setCommandPaletteOpened(true);
          } else {
            setCommandPaletteOpened(false);
          }
          setNote({ ...note, content: value });
        }}
      />
      <div className="flex-row gap-5">
        <h3>{t("color")}</h3>
        <input
          type="color"
          value={note?.color || "#09090d"}
          onChange={(e) => setNote({ ...note, color: e.target.value })}
        />
        <Button
          // usesAI={true}
          svg={SVGS.generate}
          title={t("generateColor")}
          onClick={() => {
            generateColor();
          }}
        />
      </div>
      <div className="flex-row gap-5 align-center">
        <LabeledInput
          label={t("tags")}
          type="text"
          name="tags"
          getAIContext={() => `
            Generate tags for a note.
            The tags should be related to the note.
            This is the title of the note:
            ${note?.title || ""}

            This is the content of the note:
            ${note?.content || ""}

            This are the current tags of the note:
            ${note?.tags?.join(",") || ""}

            You should generate a single tag, this will be added to the tag list of the note.
          `}
          aiButton={true}
          value={note?.tags?.join(",") || ""}
          onChange={(value) => setNote({ ...note, tags: value.split(",") })}
        />
      </div>
      <div className="flex-row gap-5 align-center">
        <h3>{t("archived")}</h3>
        <input
          type="checkbox"
          className="checkbox"
          checked={note?.archived}
          onChange={(e) => setNote({ ...note, archived: e.target.checked })}
        />
      </div>
    </div>
  );
};
