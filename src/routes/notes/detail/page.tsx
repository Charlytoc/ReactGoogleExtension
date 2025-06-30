import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChromeStorageManager } from "../../../managers/Storage";
import { TBackgroundType, TMessage, TNote } from "../../../types";
import { Button } from "../../../components/Button/Button";
import { SVGS } from "../../../assets/svgs";
import { useTranslation } from "react-i18next";
import { buildBackground, cacheLocation } from "../../../utils/lib";
// import { StyledMarkdown } from "../../../components/RenderMarkdown/StyledMarkdown";
import { Section } from "../../../components/Section/Section";
// import { NoteEditor } from "../../../components/Note/Note";
import {
  convertToMessage,
  createStreamingResponseWithFunctions,
  createToolsMap,
  toolify,
  TTool,
} from "../../../utils/ai";
import { LabeledInput } from "../../../components/LabeledInput/LabeledInput";
import { useStore } from "../../../managers/store";
import { useShallow } from "zustand/shallow";
import { Message } from "../../../components/Chat/Chat";
import toast from "react-hot-toast";
// import { Textarea } from "../../../components/Textarea/Textarea";
import { Select } from "../../../components/Select/Select";
import { Textarea } from "../../../components/Textarea/Textarea";
import { StyledMarkdown } from "../../../components/RenderMarkdown/StyledMarkdown";

const Prompter = ({
  systemPrompt,
  functions,
}: // onComplete,
{
  systemPrompt: string;
  // apiKey: string;
  functions: TTool[];
  // onComplete: (response: string) => void;
}) => {
  const { t } = useTranslation();
  const auth = useStore(useShallow((state) => state.config.auth));
  const [messages, setMessages] = useState<TMessage[]>([
    { role: "system", content: systemPrompt },
  ]);
  const [state, setState] = useState<{
    isGenerating: boolean;
    isOpen: boolean;
    response: string;
    userMessage: string;
  }>({
    isGenerating: false,
    response: "",
    isOpen: false,
    userMessage: "",
  });

  useEffect(() => {
    setMessages((prev) => {
      let newMessages = [...prev];
      const systemMessage = newMessages.find((m) => m.role === "system");
      if (systemMessage) {
        systemMessage.content = systemPrompt;
      } else {
        newMessages.unshift({ role: "system", content: systemPrompt });
      }
      return newMessages;
    });
  }, [systemPrompt]);

  const handleGenerate = async () => {
    setState({ ...state, isGenerating: true });

    const userMessage: TMessage = { role: "user", content: state.userMessage };
    const assistantMessage: TMessage = { role: "assistant", content: "" };
    const newMessages = [...messages, userMessage, assistantMessage];

    setState((prev) => ({ ...prev, userMessage: "" }));
    setMessages(newMessages);

    await createStreamingResponseWithFunctions(
      {
        messages: newMessages.map(convertToMessage),
        model: "gpt-4o-mini",
        temperature: 0.4,
        apiKey: auth.openaiApiKey,
        max_completion_tokens: 16000,
        response_format: { type: "text" },
        tools: functions.map((tool) => tool.schema),
        functionMap: createToolsMap(functions),
      },
      (chunk) => {
        const text = chunk.choices[0].delta.content;
        if (text) {
          setMessages((prev) => {
            let newMessages = [...prev];
            const lastAssistantMessage = newMessages.pop();

            if (!lastAssistantMessage) return newMessages;
            lastAssistantMessage.content += text;
            return [...newMessages, lastAssistantMessage];
          });
        }
      }
    );
    setState((prev) => ({ ...prev, isGenerating: false }));
  };
  return (
    <>
      <Button
        title={t("continueWithAI")}
        className={`w-100 justify-center padding-5 ${
          state.isGenerating ? "bg-active" : ""
        }`}
        onClick={() => setState({ ...state, isOpen: true })}
        svg={SVGS.ai}
      />
      {state.isOpen && (
        <div className="prompter-container bg-gradient flex-column gap-10 ">
          {messages.map((message, index) => {
            if (message.role === "system") return null;
            return <Message key={index} message={message} />;
          })}

          <LabeledInput
            autoFocus
            label={t("userMessage")}
            type="text"
            name="userMessage"
            value={state.userMessage}
            onChange={(value) =>
              setState({
                ...state,
                userMessage: value,
              })
            }
          />

          <div className="flex-row gap-5">
            <Button
              title={t("generate")}
              onClick={handleGenerate}
              svg={SVGS.ai}
              text={state.isGenerating ? t("generating") : t("execute")}
              className="w-100 justify-center padding-5 "
            />
            <Button
              title={t("close")}
              text={t("close")}
              className="w-100 justify-center padding-5 "
              onClick={() => setState({ ...state, isOpen: false })}
              svg={SVGS.close}
            />
          </div>
        </div>
      )}
    </>
  );
};

const BROWSER_FONTS = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Verdana", value: "Verdana, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", serif' },
  { label: "Trebuchet MS", value: '"Trebuchet MS", sans-serif' },
  { label: "Tahoma", value: "Tahoma, sans-serif" },
  { label: "Courier New", value: '"Courier New", monospace' },
  { label: "Comic Sans MS", value: '"Comic Sans MS", cursive' },
  { label: "Lucida Console", value: '"Lucida Console", monospace' },
  { label: "Impact", value: "Impact, sans-serif" },
];

export default function NoteDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [notes, setNotes] = useState<TNote[]>([]);
  const [isEditing, setIsEditing] = useState(false);

  if (!id) return <div>No id</div>;
  const [note, setNote] = useState<TNote>({
    id: id,
    title: "",
    content: "",
    color: "var(--bg-color)",
    tags: [],
    archived: false,
    font: "Arial",
    backgroundType: "solid",
    color2: "var(--bg-color-secondary)",
    imageURL: "",
    opacity: 0.5,
  });
  // const [isEditing, setIsEditing] = useState(false);
  // const [isGenerating, setIsGenerating] = useState(false);
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

    console.log(newNotes, "newNotes");
    await ChromeStorageManager.add("notes", newNotes);
  };

  const updateColorTool = toolify(
    (args: { color: string }) => {
      console.log(args.color, "color from updateColorTool");

      setNote({ ...note, color: args.color });
      toast.success(t("noteUpdated"));
      return "Color updated successfully";
    },
    "updateColorTool",
    "Update the background color of the note. The color should be a valid CSS color. Include the alpha value if you want a transparent color.",
    {
      color: {
        type: "string",
        description: "The new color to update the note",
      },
    }
  );

  const updateTitleTool = toolify(
    (args: { title: string }) => {
      setNote({ ...note, title: args.title });
      toast.success(t("noteUpdated"));
      return "Title updated successfully";
    },
    "updateTitleTool",
    "Update the title of the note. The title should be a string. The title should be a short description of the note.",
    {
      title: {
        type: "string",
        description: "The new title to update the note",
      },
    }
  );

  // const replaceInNote = toolify(
  //   ({
  //     searchString,
  //     replacement,
  //   }: {
  //     searchString: string;
  //     replacement: string;
  //   }) => {
  //     const newContent = note.content?.replace(searchString, replacement) || "";
  //     if (!newContent) return "No replacement provided";
  //     setNote({ ...note, content: newContent });
  //     return "Note updated successfully";
  //   },
  //   "replaceInNote",
  //   "Replace a particular part of the note content. Use this tool when you need to update a specific part of the note.",
  //   {
  //     searchString: {
  //       type: "string",
  //       description: "The string to search for in the note",
  //     },
  //     replacement: {
  //       type: "string",
  //       description: "The new content to update the note",
  //     },
  //   }
  // );

  const processImage = (file: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setNote({ ...note, imageURL: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const updateNoteContent = toolify(
    (newContent: { newContent: string }) => {
      console.log("AI wants to update the entire note", newContent);
      setNote({ ...note, content: newContent.newContent });
      toast.success(t("noteUpdated"));
      return "Note updated successfully";
    },
    "updateNoteContent",
    "Update the content of the note. Use this tool when you need to make changes to the note. The function expects a string representing the entire content of the note.",
    {
      newContent: {
        type: "string",
        description:
          "The new content to update the note. The content should be a string representing the entire content of the note.",
      },
    }
  );

  return (
    <div className=" padding-10">
      <Section
        style={{
          background: buildBackground(
            note.color,
            note.color2,
            note.backgroundType || "solid",
            note.imageURL
          ),
          fontFamily: note.font || "Arial",
        }}
        close={async () => {
          const prevPage = await ChromeStorageManager.get("prevPage");

          cacheLocation(prevPage, "lastPage");
          navigate(prevPage);
        }}
        headerLeft={
          <h3
            autoFocus={!note.title}
            contentEditable
            onBlur={(e) => setNote({ ...note, title: e.target.innerText })}
            suppressContentEditableWarning
            className={`padding-5 ${note.title ? "" : "bg-active"}`}
          >
            {note?.title || ""}
          </h3>
        }
        headerRight={
          <div className="flex-row gap-5">
            <Prompter
              systemPrompt={`
## SYSTEM

You are a powerful note taking assistant.
You will be given a note and you will need to update the note based on the context and instructions you have. You can use a set of tools to help you manage the note and customize it to match the user's needs.

This is a JSON representation of the note:
\`\`\`json 
${JSON.stringify(note)}
\`\`\`
                
## RULES
- Use the right tool depending on the task in hand.
- Provide useful insights about the note and the changes you are making.
- Ask for clarification if needed.
  
                    `}
              functions={[updateNoteContent, updateColorTool, updateTitleTool]}
            />
            <Button
              title={isEditing ? t("close") : t("edit")}
              onClick={() => setIsEditing(!isEditing)}
              svg={isEditing ? SVGS.close : SVGS.edit}
            />
          </div>
        }
      >
        <div className="w-100 padding-bottom-50">
          {isEditing ? (
            <div className="flex-column gap-5">
              <Textarea
                defaultValue={note.content || ""}
                onChange={(value) => setNote({ ...note, content: value })}
                name="content"
                placeholder={t("writeYourNoteHere")}
                isMarkdown
                maxHeight="75vh"
              />
              <h3>{t("customization")}</h3>
              <span>{t("font")}</span>
              <Select
                options={[
                  ...BROWSER_FONTS,
                  { label: "ShareTechMono", value: "ShareTechMono" },
                  // { label: "Courier", value: "Courier" },
                ]}
                defaultValue={note.font || "Arial"}
                onChange={(value) => setNote({ ...note, font: value })}
                name="font"
              />
              <p>
                <span>{t("backgroundType")}: </span>
                <select
                  value={note.backgroundType}
                  onChange={(e) =>
                    setNote({
                      ...note,
                      backgroundType: e.target.value as TBackgroundType,
                    })
                  }
                >
                  <option value="gradient">{t("gradient")}</option>
                  <option value="solid">{t("solid")}</option>
                  <option value="none">{t("none")}</option>
                  <option value="image">{t("image")}</option>
                </select>
              </p>
              <p className="flex-row gap-5 align-center">
                {note.backgroundType === "gradient" && (
                  <>
                    <span>Color 1: </span>
                    <input
                      type="color"
                      value={note.color}
                      onChange={(e) =>
                        setNote({ ...note, color: e.target.value })
                      }
                    />
                    <span>Color 2: </span>
                    <input
                      type="color"
                      value={note.color2}
                      onChange={(e) =>
                        setNote({ ...note, color2: e.target.value })
                      }
                    />
                  </>
                )}
                {note.backgroundType === "image" && (
                  <div className="flex-column gap-5 align-center justify-center">
                    <span>Image: </span>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          processImage(file);
                        }
                      }}
                    />
                    <span>Opacity: </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      onChange={(e) => {
                        setNote({
                          ...note,
                          opacity: parseFloat(e.target.value),
                        });
                        document.documentElement.style.setProperty(
                          "--overlay-opacity",
                          `${parseFloat(e.target.value)}`
                        );
                      }}
                    />
                  </div>
                )}
                {note.backgroundType === "solid" && (
                  <>
                    <span>Color: </span>
                    <input
                      type="color"
                      value={note.color}
                      onChange={(e) =>
                        setNote({ ...note, color: e.target.value })
                      }
                    />
                  </>
                )}
              </p>
              <div className="flex-row gap-5 align-center">
                <h3>{t("archived")}</h3>
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={note?.archived}
                  onChange={(e) =>
                    setNote({ ...note, archived: e.target.checked })
                  }
                />
              </div>
              <div className="flex-row gap-5 align-center">
                <h3>{t("tags")}</h3>
                <input
                  className="input"
                  type="text"
                  value={note.tags?.join(", ") || ""}
                  onChange={(e) =>
                    setNote({ ...note, tags: e.target.value.split(",") })
                  }
                />
              </div>
            </div>
          ) : (
            <StyledMarkdown markdown={note.content || ""} />
          )}
        </div>
      </Section>
    </div>
  );
}
