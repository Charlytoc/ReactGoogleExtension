import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ChromeStorageManager } from "../../../managers/Storage";
import { TBackgroundType, TMessage, TNote } from "../../../types";
import { Button } from "../../../components/Button/Button";
import { SVGS } from "../../../assets/svgs";
import { useTranslation } from "react-i18next";
import { buildBackground, cacheLocation, generateRandomId } from "../../../utils/lib";
import { openExtensionRouteInNewTab } from "../../../utils/chromeFunctions";
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
import { useStore } from "../../../managers/store";
import { AIInput } from "../../../components/AIInput/AIInput";
import { useShallow } from "zustand/shallow";
import { Message } from "../../../components/Chat/Chat";
import toast from "react-hot-toast";
// import { Textarea } from "../../../components/Textarea/Textarea";
import { TagsField } from "../../../components/TagsField/TagsField";
import { Select } from "../../../components/Select/Select";
import {
  collectAllTags,
  migrateFormatter,
  migrateSnaptie,
  migrateTask,
} from "../../../utils/tags";
import { NOTE_FONT_OPTIONS } from "../../../utils/noteTheme";
import {
  AI_COVER_JOBS_KEY,
  enqueueNoteCoverJob,
  enqueueNoteImageJob,
  getCoverJobs,
  isImageJobStale,
  type TCoverJobMap,
} from "../../../utils/imageJobs";
import { getNotesAssistantModelSlug } from "../../../utils/aiConfigStorage";
import {
  clearNoteConversation,
  getNoteConversation,
  loadAllConversations,
  removeConversationsForNote,
  saveAllConversations,
  saveNoteConversation,
  withUpdatedSystemPrompt,
} from "../../../utils/conversationsStorage";
import { Textarea } from "../../../components/Textarea/Textarea";
import { StyledMarkdown } from "../../../components/RenderMarkdown/StyledMarkdown";
import { Text } from "@mantine/core";

const Prompter = ({
  noteId,
  noteTitle,
  systemPrompt,
  functions,
  isOpen,
  onOpenChange,
  showTrigger = true,
}: {
  noteId: string;
  noteTitle?: string;
  systemPrompt: string;
  functions: TTool[];
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  showTrigger?: boolean;
}) => {
  const { t } = useTranslation();
  const auth = useStore(useShallow((state) => state.config.auth));
  const [isOpenInternal, setIsOpenInternal] = useState(false);
  const resolvedIsOpen = isOpen ?? isOpenInternal;
  const setIsOpen = onOpenChange ?? setIsOpenInternal;
  const [messages, setMessages] = useState<TMessage[]>([
    { role: "system", content: systemPrompt },
  ]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const isLoadingConversationRef = useRef(true);
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
  const systemPromptRef = useRef(systemPrompt);
  systemPromptRef.current = systemPrompt;

  useEffect(() => {
    let mounted = true;
    isLoadingConversationRef.current = true;

    void (async () => {
      const all = await loadAllConversations();
      const existing = getNoteConversation(all, noteId);
      if (!mounted) return;

      if (existing?.messages?.length) {
        setMessages(
          withUpdatedSystemPrompt(systemPromptRef.current, existing.messages)
        );
        setConversationId(existing.id);
      } else {
        setMessages([{ role: "system", content: systemPromptRef.current }]);
        setConversationId(null);
      }
      isLoadingConversationRef.current = false;
    })();

    return () => {
      mounted = false;
    };
  }, [noteId]);

  useEffect(() => {
    if (isLoadingConversationRef.current) return;
    setMessages((prev) => withUpdatedSystemPrompt(systemPrompt, prev));
  }, [systemPrompt]);

  useEffect(() => {
    if (isLoadingConversationRef.current) return;

    const hasChatMessages = messages.some(
      (message) => message.role === "user" || message.role === "assistant"
    );
    if (!hasChatMessages) return;

    void (async () => {
      const saved = await saveNoteConversation(noteId, messages, {
        conversationId: conversationId ?? undefined,
        title: noteTitle?.trim() || "Note chat",
      });
      setConversationId((prev) => (prev === saved.id ? prev : saved.id));
    })();
  }, [messages, noteId, noteTitle, conversationId]);

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
      const model = await getNotesAssistantModelSlug();
      await createStreamingResponseWithFunctions(
        {
          messages: newMessages.map(convertToMessage),
          model,
          apiKey: auth.openaiApiKey,
          max_completion_tokens: 16000,
          response_format: { type: "text" },
          tools: functions.map((tool) => tool.schema),
          functionMap: createToolsMap(functions),
        },
        (textDelta) => {
          if (!textDelta) return;
          setMessages((prev) => {
            const lastAssistantMessage = prev[prev.length - 1];
            if (!lastAssistantMessage || lastAssistantMessage.role !== "assistant") {
              return prev;
            }
            return [
              ...prev.slice(0, -1),
              {
                ...lastAssistantMessage,
                content: `${lastAssistantMessage.content || ""}${textDelta}`,
              },
            ];
          });
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

  const hasChatMessages = messages.some(
    (message) => message.role === "user" || message.role === "assistant"
  );

  const startNewChat = async () => {
    isLoadingConversationRef.current = true;
    await clearNoteConversation(noteId);
    setMessages([{ role: "system", content: systemPromptRef.current }]);
    setConversationId(null);
    setState((prev) => ({ ...prev, userMessage: "" }));
    isLoadingConversationRef.current = false;
  };

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
            <div className="prompter-toolbar flex-row justify-end">
              <Button
                className="padding-5"
                text={t("startNewNoteChat")}
                svg={SVGS.plus}
                onClick={startNewChat}
                confirmations={
                  hasChatMessages
                    ? [
                        {
                          text: t("startNewNoteChatConfirm"),
                          className: "bg-danger",
                        },
                      ]
                    : []
                }
              />
            </div>
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
  const [isGeneratingNoteStyle, setIsGeneratingNoteStyle] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
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

  // Cover job lifecycle: restore the in-progress state when (re)opening the
  // note, and pick up the background worker's result when the job resolves.
  useEffect(() => {
    let mounted = true;

    const applyStoredNoteTheme = async () => {
      const stored = (await ChromeStorageManager.get("notes")) as
        | TNote[]
        | undefined;
      const storedNote = Array.isArray(stored)
        ? stored.find((n) => n.id === id)
        : undefined;
      if (!storedNote || !mounted) return;
      // Merge only the fields the cover job writes; local content edits win.
      setNote((prev) => ({
        ...prev,
        coverImage: storedNote.coverImage,
        backgroundType: storedNote.backgroundType,
        color: storedNote.color,
        color2: storedNote.color2,
        font: storedNote.font,
        tags: storedNote.tags,
        imageURL: storedNote.imageURL,
      }));
    };

    const syncCoverJob = async () => {
      const jobs = await getCoverJobs();
      if (!mounted) return;
      const job = jobs[id];
      setIsGeneratingNoteStyle(
        !!job && job.status === "pending" && !isImageJobStale(job)
      );
    };

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local" || !changes[AI_COVER_JOBS_KEY]) return;
      const nextJobs = (changes[AI_COVER_JOBS_KEY].newValue ??
        {}) as TCoverJobMap;
      const prevJobs = (changes[AI_COVER_JOBS_KEY].oldValue ??
        {}) as TCoverJobMap;
      const job = nextJobs[id];
      const prevJob = prevJobs[id];

      if (!job && prevJob?.status === "pending") {
        // Job deleted => success: the worker already merged the result into
        // the stored note.
        void applyStoredNoteTheme();
        setIsGeneratingNoteStyle(false);
        toast.success(t("noteStyleGenerated") || "Note style updated!");
        return;
      }
      if (job?.status === "error" && prevJob?.status !== "error") {
        setIsGeneratingNoteStyle(false);
        toast.error(t("failedToGenerateCover") || "Failed to generate cover");
        return;
      }
      if (job?.status === "pending") {
        setIsGeneratingNoteStyle(true);
      }
    };

    syncCoverJob();
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(onStorageChanged);
    };
  }, [id]);

  useEffect(() => {
    if (note) {
      saveNote();
    }
  }, [note]);

  const getNote = async () => {
    const [notes, tasksRaw, snaptiesRaw, formattersRaw] = await Promise.all([
      ChromeStorageManager.get("notes"),
      ChromeStorageManager.get("tasks"),
      ChromeStorageManager.get("snapties"),
      ChromeStorageManager.get("formatters"),
    ]);

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
      const tasks = Array.isArray(tasksRaw) ? tasksRaw.map(migrateTask) : [];
      const snapties = Array.isArray(snaptiesRaw)
        ? snaptiesRaw.map(migrateSnaptie)
        : [];
      const formatters = Array.isArray(formattersRaw)
        ? formattersRaw.map(migrateFormatter)
        : [];
      setTagSuggestions(
        collectAllTags({
          notes,
          tasks,
          snapties,
          formatters,
        })
      );
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

  /**
   * Enqueues the full cover pipeline (theme JSON + image + note merge) in the
   * background worker. The spinner is turned off by the cover-job listener
   * effect when the job completes or fails — even across popup reopens.
   */
  const generateCover = async () => {
    if (!auth.openaiApiKey) {
      toast.error(t("noApiKey") || "No API key found");
      return;
    }
    setIsGeneratingNoteStyle(true);
    try {
      await enqueueNoteCoverJob({
        noteId: note.id,
        hint: coverPrompt.trim(),
        tagCatalog: tagSuggestions.slice(0, 250),
      });
      toast.success(t("imageGenerationStarted"));
    } catch (error) {
      console.error("Error starting cover generation", error);
      toast.error(t("failedToGenerateCover") || "Failed to generate cover");
      setIsGeneratingNoteStyle(false);
    }
  };

  /**
   * Context for the prompt-generation step: always the whole note, and when
   * the generation was triggered from a specific block, that block first —
   * marked as the focus the image belongs to.
   */
  const buildNoteImageContext = (blockContext?: string) => {
    const noteContext = `Note title: ${note.title || "Untitled"}

Note content (excerpt):
${(note.content || "").slice(0, 1500)}`;

    const block = blockContext?.trim();
    if (!block) {
      return noteContext;
    }

    return `Selected block — the image will illustrate this part of the note:
${block}

Full note for additional context:
${noteContext}`;
  };

  /**
   * Starts a background image generation job and immediately returns the
   * placeholder markdown referencing the pre-assigned attachment id. The
   * background worker saves the attachment under that id when it finishes;
   * RenderMarkdown resolves the reference (or shows a pending placeholder)
   * from storage.
   */
  const createNoteImageAttachment = async (
    instruction: string,
    altText: string,
    size: string,
    context?: string
  ): Promise<{ markdown: string; attachmentId: string } | null> => {
    if (!instruction.trim() || !auth.openaiApiKey) {
      return null;
    }

    try {
      const attachmentId = generateRandomId("attachment");
      const label = altText.trim() || "generated image";
      await enqueueNoteImageJob({
        attachmentId,
        noteId: note.id,
        prompt: instruction.trim(),
        context: buildNoteImageContext(context),
        altText: label,
        size: normalizeImageSize(size),
      });
      return {
        attachmentId,
        markdown: `![${label}](attachment:${attachmentId})`,
      };
    } catch (error) {
      console.error("Error starting note image generation", error);
      return null;
    }
  };

  const handleGenerateBlockImage = async (
    instruction: string,
    altText: string,
    size: string,
    context?: string
  ) => {
    const result = await createNoteImageAttachment(
      instruction,
      altText,
      size,
      context
    );
    if (result) {
      toast.success(t("imageGenerationStarted"));
    }
    return result?.markdown ?? null;
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

    const result = await createNoteImageAttachment(
      instruction,
      altText,
      size
    );
    if (!result) {
      return "Could not generate image";
    }

    appendAttachmentToNote(result.attachmentId, altText || "generated image");
    toast.success(t("imageGenerationStarted"));
    return JSON.stringify({
      success: true,
      status: "generating",
      detail:
        "Image generation started in the background. The markdown placeholder was already appended to the note and will display the image once ready.",
      attachmentId: result.attachmentId,
      markdown: result.markdown,
    });
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
    const allConversations = await loadAllConversations();
    await saveAllConversations(removeConversationsForNote(allConversations, id!));
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
              svg={SVGS.openExternal}
              title={t("openNoteInTab")}
              onClick={() => {
                openExtensionRouteInNewTab(`/notes/${id}`);
              }}
            />
            <Button
              className="justify-center padding-5"
              svg={SVGS.copy}
              title={t("copyNote")}
              onClick={() => {
                const title = note.title?.trim();
                const textToCopy = title
                  ? `# ${title}\n\n${note.content || ""}`.trimEnd()
                  : note.content || "";
                void navigator.clipboard.writeText(textToCopy).then(() => {
                  toast.success(t("noteCopied"));
                });
              }}
            />
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
              svg={SVGS.gear}
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
          noteId={note.id}
          noteTitle={note.title}
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
              onGenerateBlockImage={handleGenerateBlockImage}
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
              {isGeneratingNoteStyle && (
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
                  <span style={{ color: "#fff", fontWeight: 600 }}>
                    {t("generatingNoteStyle")}
                  </span>
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
                options={[...NOTE_FONT_OPTIONS]}
                defaultValue={note.font || NOTE_FONT_OPTIONS[0].value}
                onChange={(value: string) => setNote({ ...note, font: value })}
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
                <h3>{t("generateCover")}</h3>
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
                    disabled={isGeneratingNoteStyle}
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
              <TagsField
                label={t("tags")}
                value={note.tags ?? []}
                onChange={(tags) => setNote({ ...note, tags })}
                suggestions={tagSuggestions}
                hint={t("tags-comma-hint")}
              />
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
                <p>
                  <strong>Customization</strong> (gear icon in the top bar) lets you change the
                  font, background, and run AI styling: it can set a cover image, solid or gradient
                  colors, font, and suggest tags merged with your existing tags.
                </p>
                <p><strong>Cover image</strong>: type a hint and press Enter or click the sparkles button — the AI uses the note title and content to craft a detailed image prompt automatically.</p>
              </div>
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}
