import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChromeStorageManager } from "../../../managers/Storage";
import { TAttachment, TBackgroundType, TMessage, TNote } from "../../../types";
import { Button } from "../../../components/Button/Button";
import { SVGS } from "../../../assets/svgs";
import { useTranslation } from "react-i18next";
import { buildBackground, cacheLocation, generateRandomId } from "../../../utils/lib";
// import { StyledMarkdown } from "../../../components/RenderMarkdown/StyledMarkdown";
import { Section } from "../../../components/Section/Section";
// import { NoteEditor } from "../../../components/Note/Note";
import {
  convertToMessage,
  createCompletion,
  createStreamingResponseWithFunctions,
  createToolsMap,
  generateImage,
  toolify,
  TTool,
} from "../../../utils/ai";
import { useStore } from "../../../managers/store";
import { AIInput } from "../../../components/AIInput/AIInput";
import { useShallow } from "zustand/shallow";
import { Message } from "../../../components/Chat/Chat";
import toast from "react-hot-toast";
// import { Textarea } from "../../../components/Textarea/Textarea";
import { Select } from "../../../components/Select/Select";
import { Textarea } from "../../../components/Textarea/Textarea";
import { StyledMarkdown } from "../../../components/RenderMarkdown/StyledMarkdown";
import { Text } from "@mantine/core";

const Prompter = ({
  systemPrompt,
  functions,
  isOpen,
  onOpenChange,
  showTrigger = true,
}: // onComplete,
{
  systemPrompt: string;
  // apiKey: string;
  functions: TTool[];
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  showTrigger?: boolean;
  // onComplete: (response: string) => void;
}) => {
  const { t } = useTranslation();
  const auth = useStore(useShallow((state) => state.config.auth));
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const resolvedIsOpen = isOpen ?? isOpenInternal;
  const setIsOpen = onOpenChange ?? setIsOpenInternal;
  const [messages, setMessages] = useState<TMessage[]>([
    { role: "system", content: systemPrompt },
  ]);
  const [state, setState] = useState<{
    isGenerating: boolean;
    response: string;
    userMessage: string;
  }>({
    isGenerating: false,
    response: "",
    userMessage: "",
  });
  const [chatContainer, setChatContainer] = useState<HTMLDivElement | null>(null);
  const generationLockRef = useRef(false);

  useEffect(() => {
    setMessages((prev) => {
      const systemMessageIndex = prev.findIndex((m) => m.role === "system");
      if (systemMessageIndex === -1) {
        return [{ role: "system", content: systemPrompt }, ...prev];
      }
      return prev.map((message, index) =>
        index === systemMessageIndex
          ? { ...message, content: systemPrompt }
          : message
      );
    });
  }, [systemPrompt]);

  const handleGenerate = async () => {
    if (generationLockRef.current) return;
    const trimmedMessage = state.userMessage.trim();
    if (!trimmedMessage) return;
    if (!auth.openaiApiKey) {
      toast.error("Missing OpenAI API key");
      return;
    }

    generationLockRef.current = true;
    setState((prev) => ({ ...prev, isGenerating: true, userMessage: "" }));

    const userMessage: TMessage = { role: "user", content: trimmedMessage };
    const assistantMessage: TMessage = { role: "assistant", content: "" };
    const newMessages = [...messages, userMessage, assistantMessage];
    setMessages(newMessages);

    try {
      await createStreamingResponseWithFunctions(
        {
          messages: newMessages.map(convertToMessage),
          model: "gpt-5.2",
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
              const lastAssistantMessage = prev[prev.length - 1];
              if (!lastAssistantMessage || lastAssistantMessage.role !== "assistant") {
                return prev;
              }
              return [
                ...prev.slice(0, -1),
                {
                  ...lastAssistantMessage,
                  content: `${lastAssistantMessage.content || ""}${text}`,
                },
              ];
            });
          }
        }
      );
    } finally {
      generationLockRef.current = false;
      setState((prev) => ({ ...prev, isGenerating: false }));
    }
  };

  useEffect(() => {
    if (!chatContainer) return;
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }, [messages, chatContainer]);

  return (
    <>
      {showTrigger && (
        <Button
          title={resolvedIsOpen ? t("close") : t("continueWithAI")}
          className={`w-100 justify-center padding-5 ${
            state.isGenerating ? "bg-active" : ""
          }`}
          onClick={() => setIsOpen(!resolvedIsOpen)}
          svg={resolvedIsOpen ? SVGS.close : SVGS.ai}
        />
      )}
      {resolvedIsOpen && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 999 }}
            onClick={() => setIsOpen(false)}
          />
          <div className="prompter-container bg-gradient">
            <div className="prompter-chat-messages" ref={setChatContainer}>
              {messages.map((message, index) => {
                if (message.role === "system") return null;
                return <Message key={index} message={message} />;
              })}
            </div>

            <div className="prompter-chat-input-area">
              <AIInput
                value={state.userMessage}
                onChange={(value) => setState({ ...state, userMessage: value })}
                onSubmit={handleGenerate}
                isLoading={state.isGenerating}
                autoFocus
              />
            </div>
          </div>
        </>
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

type TImageSizeOption = "1024x1024" | "1024x1536" | "1536x1024" | "auto";

export default function NoteDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const [notes, setNotes] = useState<TNote[]>([]);
  const isLoaded = useRef(false);
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
  const [isPrompterOpen, setIsPrompterOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [coverPrompt, setCoverPrompt] = useState("");
  const [isGeneratingCover, setIsGeneratingCover] = useState(false);
  const auth = useStore(useShallow((state) => state.config.auth));

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
    if (!Array.isArray(notes)) {
      cacheLocation("/notes");
      navigate("/notes");
      return;
    }
    const note = notes.find((note) => note.id === id);
    if (!note) {
      cacheLocation("/notes");
      navigate("/notes");
    } else {
      setNotes(notes);
      setNote(note);
      isLoaded.current = true;
    }
  };

  const saveNote = async () => {
    if (!isLoaded.current) return;
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

  const saveAttachment = async (attachment: TAttachment) => {
    const attachments: TAttachment[] =
      (await ChromeStorageManager.get("attachments")) || [];
    await ChromeStorageManager.add("attachments", [...attachments, attachment]);
  };

  const appendAttachmentToNote = (attachmentId: string, altText: string) => {
    const markdownImage = `\n\n![${altText}](attachment:${attachmentId})\n`;
    setNote((prev) => ({
      ...prev,
      content: `${prev.content || ""}${markdownImage}`,
    }));
  };

  const normalizeImageSize = (size: string): TImageSizeOption => {
    const allowedSizes: TImageSizeOption[] = [
      "1024x1024",
      "1024x1536",
      "1536x1024",
      "auto",
    ];
    return allowedSizes.includes(size as TImageSizeOption)
      ? (size as TImageSizeOption)
      : "1024x1024";
  };

  const generateCover = async () => {
    if (!auth.openaiApiKey) {
      toast.error(t("noApiKey") || "No API key found");
      return;
    }
    setIsGeneratingCover(true);
    try {
      const refinedPrompt = await createCompletion(
        {
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You are an expert at writing prompts for AI image generation. Given a note's title, content, and an optional user hint, write a vivid, detailed image generation prompt for a wide landscape cover image that captures the essence of the note. Return only the prompt, no explanations.",
            },
            {
              role: "user",
              content: `Title: ${note.title || "Untitled"}\n\nContent: ${(note.content || "").slice(0, 1000)}\n\nUser hint: ${coverPrompt.trim() || "none"}`,
            },
          ],
          temperature: 0.8,
          max_completion_tokens: 300,
          response_format: { type: "text" },
          apiKey: auth.openaiApiKey,
        },
        () => {}
      );

      const generatedImage = await generateImage({
        prompt: refinedPrompt || note.title || "abstract cover art",
        apiKey: auth.openaiApiKey,
        model: "gpt-image-1.5",
        quality: "medium",
        size: "1536x1024",
        outputFormat: "jpeg",
        outputCompression: 70,
      });
      setNote({
        ...note,
        coverImage: `data:${generatedImage.mimeType};base64,${generatedImage.b64}`,
        backgroundType: note.backgroundType === "image" ? "solid" : note.backgroundType,
        imageURL: "",
      });
      toast.success("Cover generated!");
    } catch (e) {
      toast.error("Failed to generate cover");
    } finally {
      setIsGeneratingCover(false);
    }
  };

  const generateAndAttachImageToNote = async (
    instruction: string,
    altText: string,
    size: string
  ) => {
    if (!instruction.trim()) {
      return "No instruction provided";
    }
    if (!auth.openaiApiKey) {
      return "No API key found";
    }

    try {
      const generatedImage = await generateImage({
        prompt: instruction.trim(),
        apiKey: auth.openaiApiKey,
        model: "gpt-image-1.5",
        quality: "medium",
        size: normalizeImageSize(size),
        outputFormat: "jpeg",
        outputCompression: 60,
      });

      const attachmentId = generateRandomId("attachment");
      const attachment: TAttachment = {
        id: attachmentId,
        type: "image",
        name: `ai-image-${new Date().toISOString()}`,
        dataUrl: `data:${generatedImage.mimeType};base64,${generatedImage.b64}`,
        mimeType: generatedImage.mimeType,
        sourceNoteId: note.id,
        createdAt: new Date().toISOString(),
      };
      await saveAttachment(attachment);
      appendAttachmentToNote(attachmentId, altText || "generated image");
      toast.success(t("imageAttachedToNote"));
      return JSON.stringify({
        success: true,
        attachmentId,
        markdown: `![${altText || "generated image"}](attachment:${attachmentId})`,
      });
    } catch (error) {
      console.error("Error generating note image attachment", error);
      return "Could not generate image";
    }
  };

  const appendGeneratedImageToNoteTool = toolify(
    async (args: { instruction: string; altText: string; size: string }) => {
      return await generateAndAttachImageToNote(
        args.instruction,
        args.altText,
        args.size
      );
    },
    "appendGeneratedImageToNote",
    "Generate an image attachment and append it inside the note content as markdown. Use this when the user asks for a visual/image in the note. You should provide a detailed generation instruction based on user intent.",
    {
      instruction: {
        type: "string",
        description:
          "Detailed image generation instruction. Expand the user's intent into a richer prompt with style/composition details.",
      },
      altText: {
        type: "string",
        description: "Short alt text for the markdown image label.",
      },
      size: {
        type: "string",
        description:
          "Image size/aspect ratio. Must be one of: 1024x1024 (square), 1024x1536 (portrait), 1536x1024 (landscape), auto.",
      },
    }
  );

  const deleteCurrentNote = useCallback(async () => {
    const newNotes = notes.filter((n) => n.id !== id);
    setNotes(newNotes);
    await ChromeStorageManager.add("notes", newNotes);
    const prevPage = (await ChromeStorageManager.get("prevPage")) || "/notes";
    cacheLocation(prevPage, "lastPage");
    navigate(prevPage);
  }, [id, navigate, notes]);

  const goBack = useCallback(async () => {
    const prevPage = (await ChromeStorageManager.get("prevPage")) || "/notes";
    cacheLocation(prevPage, "lastPage");
    navigate(prevPage);
  }, [navigate]);

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

  const handleBlockChange = (
    range: { start: number; end: number },
    newMarkdown: string
  ) => {
    const normalizedMarkdown = newMarkdown.replace(/\r\n/g, "\n");
    const content = note.content || "";
    const updatedContent = `${content.slice(0, range.start)}${normalizedMarkdown}${content.slice(range.end)}`;
    if (updatedContent !== note.content) {
      setNote({ ...note, content: updatedContent });
    }
  };

  return (
    <div
      style={{
        height: "100%",
        boxSizing: "border-box",
        padding: "10px 0",
      }}
    >
      <Section
        style={{
          background: buildBackground(
            note.color,
            note.color2,
            note.backgroundType || "solid",
            note.imageURL
          ),
          fontFamily: note.font || "Arial",
          height: "100%",
        }}
        headerLeft={
          <Button
            className="justify-center padding-5"
            svg={SVGS.back}
            title={t("goBack")}
            onClick={() => {
              void goBack();
            }}
          />
        }
        headerRight={
          <>
            <Button
              className="justify-center padding-5"
              svg={SVGS.generate}
              title={
                isPrompterOpen ? t("close") : t("continueWithAI")
              }
              onClick={() => setIsPrompterOpen((prev) => !prev)}
            />
            <Button
              className="justify-center padding-5"
              svg={isMarkdownMode ? SVGS.text : SVGS.markdown}
              title={
                isMarkdownMode
                  ? `${t("text")} -> ${t("markdown")}`
                  : `${t("markdown")} -> ${t("text")}`
              }
              onClick={() => setIsMarkdownMode((prev) => !prev)}
            />
            <Button
              className="justify-center padding-5"
              svg={SVGS.palette}
              title={t("customization")}
              onClick={() => setIsCustomizeOpen(true)}
            />
            <Button
              className="justify-center padding-5"
              svg={SVGS.help}
              title={t("help")}
              onClick={() => setIsHelpOpen((prev) => !prev)}
            />
            <Button
              className="justify-center padding-5"
              svg={SVGS.trash}
              title={t("delete")}
              onClick={() => {
                if (window.confirm(t("sure?"))) {
                  void deleteCurrentNote();
                }
              }}
            />
          </>
        }
      >
        <Prompter
          showTrigger={false}
          isOpen={isPrompterOpen}
          onOpenChange={setIsPrompterOpen}
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
- When generating content that includes diagrams, flowcharts, sequences, or graphs, use Mermaid syntax inside a mermaid code block (\`\`\`mermaid ... \`\`\`). Mermaid diagrams are fully supported and rendered in this note.
- If the user asks for an image/visual inside the note, use appendGeneratedImageToNote. Do not ask the user to write a detailed generation prompt; craft it yourself from intent.
- Choose image size based on user intent: portrait for vertical compositions, landscape for wide scenes, square for icons/avatars.

          `}
          functions={[
            updateNoteContent,
            updateColorTool,
            updateTitleTool,
            appendGeneratedImageToNoteTool,
          ]}
        />
        <div
          style={{
            width: "calc(100% + 20px)",
            marginLeft: -10,
            marginRight: -10,
            marginBottom: 12,
            boxSizing: "border-box",
          }}
        >
          {note.coverImage ? (
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "220px",
                overflow: "hidden",
                borderRadius: 0,
              }}
            >
              <img
                src={note.coverImage}
                alt="cover"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    padding: "0 12px",
                    minHeight: "2.25rem",
                    boxSizing: "border-box",
                  }}
                >
                  {!note.title?.trim() ? (
                    <Text
                      size="xl"
                      style={{
                        position: "absolute",
                        left: 12,
                        right: 12,
                        textAlign: "center",
                        pointerEvents: "none",
                        color: "rgba(255,255,255,0.45)",
                        textShadow: "0 1px 8px rgba(0,0,0,0.8)",
                      }}
                    >
                      {t("noteTitlePlaceholder")}
                    </Text>
                  ) : null}
                  <h2
                    contentEditable
                    suppressContentEditableWarning
                    aria-label={t("noteTitlePlaceholder")}
                    onBlur={(e) =>
                      setNote({ ...note, title: e.currentTarget.innerText })
                    }
                    style={{
                      margin: 0,
                      width: "100%",
                      color: "#fff",
                      textShadow: "0 2px 12px rgba(0,0,0,0.9)",
                      textAlign: "center",
                      outline: "none",
                      fontFamily: note.font || "Arial",
                      position: "relative",
                      zIndex: 1,
                      boxSizing: "border-box",
                    }}
                  >
                    {note.title || ""}
                  </h2>
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{
                width: "100%",
                borderRadius: 0,
                padding: "22px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: buildBackground(
                  note.color,
                  note.color2,
                  note.backgroundType || "solid"
                ),
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  maxWidth: "100%",
                  minHeight: "2.75rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {!note.title?.trim() ? (
                  <Text
                    size="xl"
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      textAlign: "center",
                      pointerEvents: "none",
                      color: "rgba(255,255,255,0.42)",
                      textShadow: "0 1px 6px rgba(0,0,0,0.55)",
                    }}
                  >
                    {t("noteTitlePlaceholder")}
                  </Text>
                ) : null}
                <h2
                  autoFocus={!note.title}
                  contentEditable
                  suppressContentEditableWarning
                  aria-label={t("noteTitlePlaceholder")}
                  onBlur={(e) =>
                    setNote({ ...note, title: e.currentTarget.innerText })
                  }
                  style={{
                    margin: 0,
                    width: "100%",
                    maxWidth: "100%",
                    color: "#fff",
                    textShadow: "0 1px 6px rgba(0,0,0,0.5)",
                    textAlign: "center",
                    outline: "none",
                    fontFamily: note.font || "Arial",
                    minWidth: 0,
                    position: "relative",
                    zIndex: 1,
                    boxSizing: "border-box",
                  }}
                >
                  {note.title || ""}
                </h2>
              </div>
            </div>
          )}
        </div>
        <div className="w-100 h-100">
          {isMarkdownMode ? (
            <div className="flex-column gap-5 h-100">
              <Textarea
                defaultValue={note.content || ""}
                onChange={(value) => setNote({ ...note, content: value })}
                name="content"
                placeholder={t("writeYourNoteHere")}
                maxHeight="none"
                fillAvailableHeight
                containerClassName="note-raw-textarea h-100"
              />
            </div>
          ) : (
            <StyledMarkdown
              markdown={note.content || ""}
              editableBlocks={true}
              onBlockChange={handleBlockChange}
            />
          )}
        </div>
        {isCustomizeOpen && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.45)",
              zIndex: 30,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "16px",
            }}
            onClick={() => setIsCustomizeOpen(false)}
          >
            <div
              className="bg-gradient rounded padding-10 flex-column gap-10"
              style={{
                width: "min(700px, 95vw)",
                maxHeight: "85vh",
                overflowY: "auto",
                border: "1px solid var(--text-color-secondary)",
                position: "relative",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {isGeneratingCover && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", borderRadius: "inherit", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                  <span
                    className="svg-container"
                    style={{
                      display: "flex",
                      animation: "spin 1.5s linear infinite",
                      color: "#fff",
                    }}
                  >
                    {SVGS.generate}
                  </span>
                  <span style={{ color: "#fff", fontWeight: 600 }}>Generating cover...</span>
                </div>
              )}
              <div className="flex-row justify-between align-center">
                <h3>{t("customization")}</h3>
                <Button
                  className="padding-5"
                  title={t("close")}
                  svg={SVGS.close}
                  onClick={() => setIsCustomizeOpen(false)}
                />
              </div>
              <span>{t("font")}</span>
              <Select
                options={[
                  ...BROWSER_FONTS,
                  { label: "ShareTechMono", value: "ShareTechMono" },
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
                    <span>{t("color1")}: </span>
                    <input
                      type="color"
                      value={note.color}
                      onChange={(e) =>
                        setNote({ ...note, color: e.target.value })
                      }
                    />
                    <span>{t("color2")}: </span>
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
                    <span>{t("image")}: </span>
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          processImage(file);
                        }
                      }}
                    />
                    <span>{t("opacity")}: </span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={note.opacity ?? 0.5}
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
                    <span>{t("color")}: </span>
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
              <div className="flex-column gap-5">
                <h3>{t("generateCover") || "Generate Cover"}</h3>
                <div className="flex-row gap-5 align-center">
                  <input
                    className="input"
                    type="text"
                    placeholder={note.title || "Describe the cover..."}
                    value={coverPrompt}
                    onChange={(e) => setCoverPrompt(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") generateCover(); }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    className="padding-5"
                    title={t("generate") || "Generate"}
                    svg={SVGS.generate}
                    onClick={generateCover}
                    disabled={isGeneratingCover}
                  />
                </div>
                {note.coverImage && (
                  <Button
                    className="padding-5"
                    text="Remove cover"
                    svg={SVGS.trash}
                    onClick={() => setNote({ ...note, coverImage: undefined })}
                  />
                )}
              </div>
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
          </div>
        )}
        {isHelpOpen && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 30, display: "flex", justifyContent: "center", alignItems: "center", padding: "16px" }}
            onClick={() => setIsHelpOpen(false)}
          >
            <div
              className="bg-gradient rounded padding-10 flex-column gap-10"
              style={{ width: "min(500px, 95vw)", border: "1px solid var(--text-color-secondary)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-row justify-between align-center">
                <h3>How to use notes</h3>
                <Button className="padding-5" svg={SVGS.close} onClick={() => setIsHelpOpen(false)} />
              </div>
              <div className="flex-column gap-5">
                <p><strong>Shift + click</strong> any paragraph, heading, list item, or code block to edit it inline.</p>
                <p><strong>Markdown mode</strong> (the Md / T icon in the top bar) lets you edit the raw markdown source.</p>
                <p><strong>AI assistant</strong> (sparkles icon) can rewrite content, generate images, change colors, and more — just describe what you want.</p>
                <p><strong>Customization</strong> (palette icon in the top bar) lets you change the font, background, and generate an AI cover image.</p>
                <p><strong>Cover image</strong>: type a hint and press Enter or click the sparkles button — the AI uses the note title and content to craft a detailed image prompt automatically.</p>
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
