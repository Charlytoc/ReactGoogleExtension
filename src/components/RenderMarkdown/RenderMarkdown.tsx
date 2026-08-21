import {
  createContext,
  MouseEvent,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { ActionIcon, Loader, Textarea, Tooltip } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { useShallow } from "zustand/shallow";
import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import {
  createStreamingResponseWithFunctions,
  createToolsMap,
  toolify,
} from "../../utils/ai";
import { getNotesAssistantModelSlug } from "../../utils/aiConfigStorage";
import { useStore } from "../../managers/store";
import { useLocation, useNavigate } from "react-router";
import { cacheLocation, generateRandomId } from "../../utils/lib";
import { ChromeStorageManager } from "../../managers/Storage";
import { TAttachment, TNode, TNodeType } from "../../types";
import useDebounce from "../../hooks/useDebounce";
import {
  createDefaultTableMarkdown,
  parseMarkdownTable,
  serializeMarkdownTable,
  type TParsedTable,
} from "../../utils/tableMarkdown";
import {
  AI_IMAGE_JOBS_KEY,
  getImageJobs,
  isImageJobStale,
  type TImageJobMap,
} from "../../utils/imageJobs";
type TInlineEditSession = {
  nodeId: string;
  revertTo: string;
};

type TActiveInlineEditContextValue = {
  session: TInlineEditSession | null;
  startEdit: (nodeId: string, markdown: string) => void;
  /** Persists the draft without closing the editor (no setState/remount). */
  flushDraft: (draft: string) => void;
  finish: (draft: string) => void;
  cancel: () => void;
  discard: () => void;
};

const ActiveInlineEditContext = createContext<TActiveInlineEditContextValue | null>(
  null
);

const useActiveInlineEdit = () => useContext(ActiveInlineEditContext);

const downloadImageFromSrc = async (
  src: string,
  alt: string
): Promise<boolean> => {
  try {
    const response = await fetch(src);
    const blob = await response.blob();
    const extension = blob.type.split("/")[1]?.split("+")[0] || "png";
    const slug =
      (alt || "image")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "image";

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error("Could not download image", error);
    return false;
  }
};

let mermaidInitialized = false;
const ensureMermaidInitialized = () => {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
  });
  mermaidInitialized = true;
};

const markdownUrlTransform = (url: string) => {
  const normalized = (url || "").trim();
  const lowered = normalized.toLowerCase();
  if (
    lowered.startsWith("note:") ||
    lowered.startsWith("notes:") ||
    lowered.startsWith("task:") ||
    lowered.startsWith("tasks:") ||
    lowered.startsWith("attachment:") ||
    lowered.startsWith("attachments:")
  ) {
    return normalized;
  }
  return defaultUrlTransform(normalized);
};

const getAttachmentIdFromReference = (value: string) => {
  const normalized = (value || "").trim();
  const lowered = normalized.toLowerCase();
  if (lowered.startsWith("attachment:")) {
    return normalized.slice("attachment:".length).trim();
  }
  if (lowered.startsWith("attachments:")) {
    return normalized.slice("attachments:".length).trim();
  }
  return "";
};

const InsideListItemContext = createContext(false);

const hasTaskListItemClassName = (className: unknown): boolean => {
  if (className == null) return false;
  if (Array.isArray(className)) {
    return (className as unknown[]).flat().some((c) => String(c).split(/\s+/).includes("task-list-item"));
  }
  return String(className).split(/\s+/).includes("task-list-item");
};

const stringifyLiClassName = (className: unknown): string | undefined => {
  if (className == null) return undefined;
  if (Array.isArray(className)) {
    const parts = (className as unknown[]).flat(Infinity).filter(Boolean).map(String);
    return parts.length ? parts.join(" ") : undefined;
  }
  const s = String(className).trim();
  return s || undefined;
};

const findTaskCheckboxNode = (node: any): any => {
  if (node?.type === "element" && node?.tagName === "input") {
    return node;
  }

  if (!Array.isArray(node?.children)) {
    return null;
  }

  for (const child of node.children) {
    const found = findTaskCheckboxNode(child);
    if (found) return found;
  }

  return null;
};

const getTaskCheckedFromListItemSource = (slice: string): boolean | null => {
  const firstLine = slice.replace(/\r\n/g, "\n").split("\n")[0] || "";
  const match = firstLine.match(/^\s*(?:[-+*]|\d+[.)])\s+\[([ xX])\]/);
  if (!match) return null;
  return match[1].toLowerCase() === "x";
};

/** Updates `- [ ]` / `- [x]` on the first line of a GFM task list item slice. */
const replaceTaskCheckboxInListItemSource = (slice: string, checked: boolean) => {
  const normalized = slice.replace(/\r\n/g, "\n");
  const lineBreak = normalized.indexOf("\n");
  const firstLine = lineBreak === -1 ? normalized : normalized.slice(0, lineBreak);
  const rest = lineBreak === -1 ? "" : normalized.slice(lineBreak);

  let newFirst = firstLine;
  if (checked) {
    if (/\[ \]/.test(newFirst)) {
      newFirst = newFirst.replace(/\[ \]/, "[x]");
    } else {
      newFirst = newFirst.replace(/\[\s+\]/, "[x]");
    }
  } else {
    newFirst = newFirst.replace(/\[[xX]\]/, "[ ]");
  }

  return newFirst + rest;
};

export type TGenerateBlockImage = (
  instruction: string,
  altText: string,
  size: string,
  context?: string
) => Promise<string | null>;

type TBlockEditorMode = "preview" | "edit-text" | "edit-ai" | "edit-image";

const modalTextareaStyles = (monospace = false) => ({
  input: {
    fontFamily: monospace ? "monospace" : "inherit",
    fontSize: "0.9rem",
    background: "transparent",
    color: "var(--font-color)",
    border: "1px solid var(--opaque-gray-color)",
    borderRadius: "6px",
  },
});

const ActiveInlineEditProvider = ({
  onNodeChange,
  children,
}: {
  onNodeChange?: (nodeId: string, newMarkdown: string) => void;
  children: ReactNode;
}) => {
  const [session, setSession] = useState<TInlineEditSession | null>(null);
  const sessionRef = useRef(session);
  const onNodeChangeRef = useRef(onNodeChange);
  const lastFlushedDraftRef = useRef<string | null>(null);

  sessionRef.current = session;
  onNodeChangeRef.current = onNodeChange;

  // Persist to the note without setState — avoids remounting the textarea mid-edit.
  const flushQuiet = useCallback((draftInput: string) => {
    const current = sessionRef.current;
    if (!current || !onNodeChangeRef.current) return;

    const draft = draftInput.replace(/\r\n/g, "\n");
    if (lastFlushedDraftRef.current === draft) return;

    onNodeChangeRef.current(current.nodeId, draft);
    lastFlushedDraftRef.current = draft;
  }, []);

  const startEdit = useCallback((nodeId: string, markdown: string) => {
    lastFlushedDraftRef.current = markdown;
    const next = { nodeId, revertTo: markdown };
    sessionRef.current = next;
    setSession(next);
  }, []);

  const finish = useCallback((draft: string) => {
    flushQuiet(draft);
    lastFlushedDraftRef.current = null;
    sessionRef.current = null;
    setSession(null);
  }, [flushQuiet]);

  const cancel = useCallback(() => {
    const current = sessionRef.current;
    if (
      current &&
      onNodeChangeRef.current &&
      lastFlushedDraftRef.current !== current.revertTo
    ) {
      onNodeChangeRef.current(current.nodeId, current.revertTo);
    }
    lastFlushedDraftRef.current = null;
    sessionRef.current = null;
    setSession(null);
  }, []);

  const discard = useCallback(() => {
    lastFlushedDraftRef.current = null;
    sessionRef.current = null;
    setSession(null);
  }, []);

  const value: TActiveInlineEditContextValue = {
    session,
    startEdit,
    flushDraft: flushQuiet,
    finish,
    cancel,
    discard,
  };

  return (
    <ActiveInlineEditContext.Provider value={value}>
      {children}
    </ActiveInlineEditContext.Provider>
  );
};

const INLINE_DRAFT_SAVE_DEBOUNCE_MS = 500;

const InlineBlockTextEditor = ({
  initialDraft,
  onSaveDraft,
  onFinish,
  onCancel,
}: {
  initialDraft: string;
  /** Persists the draft without closing the editor (debounced while typing). */
  onSaveDraft: (draft: string) => void;
  onFinish: (draft: string) => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initialDraft);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const debouncedSaveDraft = useDebounce(onSaveDraft, INLINE_DRAFT_SAVE_DEBOUNCE_MS);

  return (
    <Textarea
      className="markdown-inline-text-editor"
      autosize
      minRows={2}
      maxRows={Math.floor((window.innerHeight * 0.7) / 24)}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value);
        // Persist quietly (no setState/remount of the markdown tree) after a
        // short pause in typing — covers Enter and any other key, without
        // closing the editor. Cmd/Ctrl+Enter or blur still finalize the edit.
        debouncedSaveDraft(e.target.value);
      }}
      onBlur={() => onFinish(draftRef.current)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
        if (e.key === "Enter" && e.metaKey) {
          e.preventDefault();
          onFinish(draftRef.current);
        }
      }}
      autoFocus
      placeholder={t("writeYourNoteHere")}
      styles={modalTextareaStyles(true)}
    />
  );
};

const BlockModalHeader = ({ title }: { title: string }) => (
  <div className="markdown-editor-modal-header">
    <h4 className="markdown-editor-modal-title">{title}</h4>
  </div>
);

const BlockModalFooter = ({
  primaryLabel,
  primaryIcon,
  onPrimary,
  onCancel,
  primaryDisabled = false,
}: {
  primaryLabel: string;
  primaryIcon: ReactNode;
  onPrimary: () => void;
  onCancel: () => void;
  primaryDisabled?: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <div className="markdown-editor-modal-footer">
      <Button
        className="padding-5 w-auto justify-center"
        text={primaryLabel}
        svg={primaryIcon}
        onClick={onPrimary}
        disabled={primaryDisabled}
      />
      <Button
        className="padding-5 w-auto justify-center"
        text={t("back")}
        svg={SVGS.back}
        onClick={onCancel}
      />
    </div>
  );
};

const MarkdownBlockEditorModal = ({
  opened,
  originalMarkdown,
  draftMarkdown,
  onChange,
  onSave,
  onCancel,
  onDelete,
  onGenerateBlockImage,
  initialMode = "preview",
}: {
  opened: boolean;
  originalMarkdown: string;
  draftMarkdown: string;
  onChange: (value: string) => void;
  onSave: (overrideValue?: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onGenerateBlockImage?: TGenerateBlockImage;
  initialMode?: TBlockEditorMode;
}) => {
  const { t } = useTranslation();
  const apiKey = useStore(useShallow((s) => s.config.auth.openaiApiKey));
  const [mode, setMode] = useState<TBlockEditorMode>(initialMode);
  const [aiInstruction, setAiInstruction] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const onSaveRef = useRef(onSave);
  const onGenerateBlockImageRef = useRef(onGenerateBlockImage);

  onSaveRef.current = onSave;
  onGenerateBlockImageRef.current = onGenerateBlockImage;

  useEffect(() => {
    if (opened) {
      setMode(initialMode);
      setAiInstruction("");
      setImagePrompt("");
    }
  }, [opened, initialMode]);

  if (!opened) return null;

  const combineWithOriginal = (imageMarkdown: string) => {
    if (!originalMarkdown.trim()) {
      return imageMarkdown;
    }
    return `${originalMarkdown.trimEnd()}\n\n${imageMarkdown}`;
  };

  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) {
      toast.error(t("pleaseAddImagePrompt"));
      return;
    }
    if (!onGenerateBlockImageRef.current) {
      return;
    }

    setIsGeneratingImage(true);
    try {
      const altText = imagePrompt.trim().slice(0, 120);
      const imageMarkdown = await onGenerateBlockImageRef.current(
        imagePrompt.trim(),
        altText,
        "1024x1024",
        originalMarkdown
      );
      if (!imageMarkdown) {
        toast.error(t("couldNotGenerateImage"));
        return;
      }
      setImagePrompt("");
      onSaveRef.current(combineWithOriginal(imageMarkdown));
    } catch {
      toast.error(t("couldNotGenerateImage"));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleApplyAI = async () => {
    if (!aiInstruction.trim()) return;
    setIsApplying(true);
    try {
      const effectiveApiKey =
        apiKey || ((await ChromeStorageManager.get("openaiApiKey")) ?? "");
      if (!effectiveApiKey) {
        toast.error(t("noApiKeyError"));
        return;
      }

      let blockSaved = false;
      let streamedText = "";

      const saveBlockTool = toolify(
        async (args: { content: string }) => {
          blockSaved = true;
          onSaveRef.current(args.content);
          return "Block saved successfully.";
        },
        "saveBlock",
        "Save the final markdown for this block. Call when editing is complete.",
        {
          content: {
            type: "string",
            description: "Complete markdown for the block, including any images.",
          },
        }
      );

      const tools = [saveBlockTool];
      if (onGenerateBlockImageRef.current) {
        const generateBlockImageTool = toolify(
          async (args: { instruction: string; altText: string; size: string }) => {
            const imageMarkdown = await onGenerateBlockImageRef.current!(
              args.instruction,
              args.altText,
              args.size,
              originalMarkdown
            );
            if (!imageMarkdown) {
              return "Could not generate image.";
            }
            return `Image markdown (embed wherever appropriate in the block):\n${imageMarkdown}`;
          },
          "generateBlockImage",
          "Generate an image and return markdown to embed in the block. Place the returned markdown wherever it fits best in the final block content.",
          {
            instruction: {
              type: "string",
              description:
                "Detailed image generation instruction based on user intent.",
            },
            altText: {
              type: "string",
              description: "Short alt text for the markdown image.",
            },
            size: {
              type: "string",
              description:
                "Image size: 1024x1024 (square), 1024x1536 (portrait), 1536x1024 (landscape), or auto.",
            },
          }
        );
        tools.push(generateBlockImageTool);
      }

      const imageToolHint = onGenerateBlockImageRef.current
        ? "- Use generateBlockImage when the user wants a visual; embed the returned markdown in the block where it fits best.\n"
        : "";

      const model = await getNotesAssistantModelSlug();

      await createStreamingResponseWithFunctions(
        {
          messages: [
            {
              role: "system",
              content: `You are a markdown block editor assistant editing a single block inside a note.
You can update text, structure, and images within this block only.

Current block:
\`\`\`
${originalMarkdown || "(empty block)"}
\`\`\`

Rules:
${imageToolHint}- When finished, call saveBlock with the complete final markdown for the block.
- Do not wrap the block in code fences.
- For diagrams use mermaid code blocks when appropriate.`,
            },
            {
              role: "user",
              content: `Instruction: ${aiInstruction}`,
            },
          ],
          model,
          max_completion_tokens: 4000,
          response_format: { type: "text" },
          apiKey: effectiveApiKey,
          tools: tools.map((tool) => tool.schema),
          functionMap: createToolsMap(tools),
        },
        (textDelta) => {
          if (!textDelta) return;
          streamedText += textDelta;
        }
      );

      setAiInstruction("");
      if (!blockSaved && streamedText.trim()) {
        onSaveRef.current(streamedText.trim());
      }
    } catch {
      toast.error("AI error");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="markdown-editor-modal-overlay" onClick={onCancel}>
      <div
        className="markdown-editor-modal bg-gradient flex-column gap-10"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === "preview" && (
          <>
            <div className="markdown-block-preview">
              <RenderMarkdown markdown={originalMarkdown} />
            </div>
            <div className="flex-row gap-5">
              <Button
                className="padding-5"
                text={t("editAsText")}
                svg={SVGS.edit}
                onClick={() => {
                  onChange(originalMarkdown);
                  setMode("edit-text");
                }}
              />
              <Button
                className="padding-5"
                text={t("editWithAI")}
                svg={SVGS.ai}
                onClick={() => setMode("edit-ai")}
              />
              {onGenerateBlockImage && (
                <Button
                  className="padding-5"
                  text={t("generateImage")}
                  svg={SVGS.generate}
                  onClick={() => setMode("edit-image")}
                />
              )}
              {onDelete && (
                <Button
                  className="padding-5"
                  title={t("delete")}
                  svg={SVGS.trash}
                  onClick={onDelete}
                  confirmations={[{ text: t("sure?"), className: "bg-danger" }]}
                />
              )}
            </div>
          </>
        )}

        {mode === "edit-text" && (
          <>
            <BlockModalHeader title={t("editAsText")} />
            <Textarea
              autosize
              minRows={4}
              maxRows={Math.floor((window.innerHeight * 0.8) / 24)}
              value={draftMarkdown}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancel();
                }
                if (e.key === "Enter" && e.metaKey) {
                  e.preventDefault();
                  onSave();
                }
              }}
              autoFocus
              placeholder={t("writeYourNoteHere")}
              styles={modalTextareaStyles(true)}
            />
            <BlockModalFooter
              primaryLabel={t("save")}
              primaryIcon={SVGS.check}
              onPrimary={onSave}
              onCancel={onCancel}
            />
          </>
        )}

        {mode === "edit-image" && onGenerateBlockImage && (
          <>
            <BlockModalHeader title={t("generateImage")} />
            {originalMarkdown.trim() ? (
              <div className="markdown-block-preview">
                <RenderMarkdown markdown={originalMarkdown} />
              </div>
            ) : null}
            <Textarea
              autosize
              minRows={3}
              maxRows={6}
              value={imagePrompt}
              onChange={(e) => setImagePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancel();
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleGenerateImage();
                }
              }}
              autoFocus
              disabled={isGeneratingImage}
              placeholder={t("describeImageToInsert")}
              styles={modalTextareaStyles()}
            />
            <BlockModalFooter
              primaryLabel={
                isGeneratingImage ? t("applyingAI") : t("generateAndInsertImage")
              }
              primaryIcon={SVGS.image}
              onPrimary={() => void handleGenerateImage()}
              onCancel={onCancel}
              primaryDisabled={isGeneratingImage || !imagePrompt.trim()}
            />
          </>
        )}

        {mode === "edit-ai" && (
          <>
            <BlockModalHeader title={t("editWithAI")} />
            {originalMarkdown.trim() ? (
              <div className="markdown-block-preview">
                <RenderMarkdown markdown={originalMarkdown} />
              </div>
            ) : null}
            <Textarea
              autosize
              minRows={3}
              maxRows={6}
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  onCancel();
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleApplyAI();
                }
              }}
              autoFocus
              disabled={isApplying}
              placeholder={t("instruction")}
              styles={modalTextareaStyles()}
            />
            <BlockModalFooter
              primaryLabel={isApplying ? t("applyingAI") : t("apply")}
              primaryIcon={SVGS.ai}
              onPrimary={() => void handleApplyAI()}
              onCancel={onCancel}
              primaryDisabled={isApplying || !aiInstruction.trim()}
            />
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Both "+" (text) and the table icon insert their new node inline and
 * immediately — no modal. Text starts empty and opens straight into the
 * same inline text editor a normal node uses (via the shared
 * ActiveInlineEditProvider), so typing starts right away; the table starts
 * pre-filled with a blank 2-column grid, which is already its own ready-to-use
 * editor, so no extra edit step is needed for it.
 */
const MarkdownInsertZone = ({
  afterNodeId,
  onNodeInsert,
  variant = "between",
}: {
  afterNodeId: string | null;
  onNodeInsert?: (afterNodeId: string | null, newMarkdown: string, nodeType?: TNodeType, nodeId?: string) => void;
  variant?: "between" | "end";
}) => {
  const { t } = useTranslation();
  const inlineEdit = useActiveInlineEdit();

  const insertText = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const nodeId = generateRandomId("node");
    onNodeInsert?.(afterNodeId, "", "markdown", nodeId);
    inlineEdit?.startEdit(nodeId, "");
  };

  const insertTable = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onNodeInsert?.(afterNodeId, createDefaultTableMarkdown(), "table");
  };

  return (
    <div
      className={`markdown-insert-zone${
        variant === "end" ? " markdown-insert-zone--end" : ""
      }`}
    >
      <button
        type="button"
        tabIndex={-1}
        className="markdown-insert-zone-button"
        title={t("insertBlock")}
        aria-label={t("insertBlock")}
        onClick={insertText}
      >
        {SVGS.plus}
      </button>
      <button
        type="button"
        tabIndex={-1}
        className="markdown-insert-zone-button"
        title={t("insertTable")}
        aria-label={t("insertTable")}
        onClick={insertTable}
      >
        {SVGS.table}
      </button>
    </div>
  );
};

const BlockActionBar = ({
  onEditText,
  onEditAI,
  onEditImage,
  onDelete,
  confirmDelete,
  onCancelDelete,
  onGenerateBlockImage,
  blockMarkdown,
}: {
  onEditText?: () => void;
  onEditAI?: () => void;
  onEditImage?: () => void;
  onDelete: () => void;
  confirmDelete: boolean;
  onCancelDelete: () => void;
  onGenerateBlockImage?: TGenerateBlockImage;
  blockMarkdown: string;
}) => {
  const { t } = useTranslation();

  const copyBlock = () => {
    void navigator.clipboard.writeText(blockMarkdown).then(() => {
      toast.success(t("codeCopied"));
    });
  };

  const blockImages = Array.from(
    blockMarkdown.matchAll(/!\[([^\]]*)\]\(\s*([^)\s]+)[^)]*\)/g)
  );

  const downloadBlockImages = async () => {
    let downloadedCount = 0;
    for (const match of blockImages) {
      const alt = match[1] || "image";
      const reference = match[2];
      const attachmentId = getAttachmentIdFromReference(reference);
      let src = reference;
      if (attachmentId) {
        const attachments: TAttachment[] =
          (await ChromeStorageManager.get("attachments")) || [];
        src =
          attachments.find((item) => item.id === attachmentId)?.dataUrl || "";
      }
      if (src && (await downloadImageFromSrc(src, alt))) {
        downloadedCount++;
      }
    }
    if (downloadedCount === 0) {
      toast.error(t("couldNotDownloadImage"));
    }
  };
  return (
    <div
      className={`markdown-block-actions${confirmDelete ? " markdown-block-actions--confirming" : ""}`}
    >
      {confirmDelete ? (
        <>
          <Tooltip label={t("sure?")} withArrow openDelay={150} position="top">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              tabIndex={-1}
              onClick={onDelete}
              aria-label={t("sure?")}
            >
              {SVGS.check}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("goBack")} withArrow openDelay={150} position="top">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              tabIndex={-1}
              onClick={onCancelDelete}
              aria-label={t("goBack")}
            >
              {SVGS.close}
            </ActionIcon>
          </Tooltip>
        </>
      ) : (
        <>
          {onEditText && (
            <Tooltip label={t("editAsText")} withArrow openDelay={400} position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                tabIndex={-1}
                onClick={onEditText}
                aria-label={t("editAsText")}
              >
                {SVGS.edit}
              </ActionIcon>
            </Tooltip>
          )}
          {onEditAI && (
            <Tooltip label={t("editWithAI")} withArrow openDelay={400} position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="grape"
                tabIndex={-1}
                onClick={onEditAI}
                aria-label={t("editWithAI")}
              >
                {SVGS.ai}
              </ActionIcon>
            </Tooltip>
          )}
          {onEditImage && onGenerateBlockImage && (
            <Tooltip label={t("generateImage")} withArrow openDelay={400} position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="blue"
                tabIndex={-1}
                onClick={onEditImage}
                aria-label={t("generateImage")}
              >
                {SVGS.image}
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label={t("copyCode")} withArrow openDelay={400} position="top">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              tabIndex={-1}
              onClick={copyBlock}
              aria-label={t("copyCode")}
            >
              {SVGS.copy}
            </ActionIcon>
          </Tooltip>
          {blockImages.length > 0 && (
            <Tooltip
              label={t("downloadImage")}
              withArrow
              openDelay={400}
              position="top"
            >
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                tabIndex={-1}
                onClick={() => void downloadBlockImages()}
                aria-label={t("downloadImage")}
              >
                <IconDownload size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          <div className="markdown-block-actions-divider" />
          <Tooltip label={t("delete")} withArrow openDelay={400} position="top">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
              tabIndex={-1}
              onClick={onDelete}
              aria-label={t("delete")}
            >
              {SVGS.trash}
            </ActionIcon>
          </Tooltip>
        </>
      )}
    </div>
  );
};

const EditableBlockShell = ({
  isEditing = false,
  confirmDelete,
  onEditText,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  onInsertAfter,
  onInsertBefore,
  ariaLabel,
  children,
  actions,
  insertZone,
  modal,
}: {
  isEditing?: boolean;
  confirmDelete: boolean;
  onEditText?: () => void;
  onRequestDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  /** "+" while the block is focused/hovered: insert a new node right after it. */
  onInsertAfter?: () => void;
  /** Shift+"+" while the block is focused/hovered: insert a new node right before it. */
  onInsertBefore?: () => void;
  ariaLabel: string;
  children: ReactNode;
  actions?: ReactNode;
  insertZone?: ReactNode;
  modal?: ReactNode;
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isEditing) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("textarea, input:not(.checkbox), [contenteditable='true']")) {
        return;
      }

      const row = rowRef.current;
      if (!row) return;

      const active = document.activeElement;
      const rowIsFocused = active === row || (active != null && row.contains(active));
      const rowIsHovered = isHovered;
      if (!rowIsFocused && !rowIsHovered && !confirmDelete) return;
      // If confirming, only this confirming row should handle keys.
      if (confirmDelete && !row.classList.contains("markdown-block-row--confirming")) {
        return;
      }
      if (!confirmDelete && !rowIsFocused && !rowIsHovered) return;

      if ((e.key === "Enter" || e.key === " ") && onEditText && !confirmDelete) {
        if (e.key === " " && target?.closest("input.checkbox")) return;
        e.preventDefault();
        e.stopPropagation();
        onEditText();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        if (confirmDelete) {
          onConfirmDelete();
        } else {
          onRequestDelete();
        }
        return;
      }

      // "<" (Shift+,) inserts a new node before this one; ">" (Shift+.) after.
      if (e.key === ">" && onInsertAfter && !confirmDelete) {
        e.preventDefault();
        e.stopPropagation();
        onInsertAfter();
        return;
      }

      if (e.key === "<" && onInsertBefore && !confirmDelete) {
        e.preventDefault();
        e.stopPropagation();
        onInsertBefore();
        return;
      }

      if (confirmDelete && e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancelDelete();
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    isEditing,
    confirmDelete,
    isHovered,
    isFocused,
    onEditText,
    onRequestDelete,
    onConfirmDelete,
    onCancelDelete,
    onInsertAfter,
    onInsertBefore,
  ]);

  return (
    <div
      ref={rowRef}
      className={`markdown-block-row${isEditing ? " markdown-block-row--editing" : ""}${
        confirmDelete ? " markdown-block-row--confirming" : ""
      }`}
      tabIndex={isEditing ? -1 : 0}
      role="group"
      aria-label={ariaLabel}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isFocused) onCancelDelete();
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setIsFocused(false);
          onCancelDelete();
        }
      }}
    >
      <div className="markdown-block-content">{children}</div>
      {!isEditing && (actions || insertZone) && (
        <div className="markdown-block-toolbar">
          {actions}
          {insertZone}
        </div>
      )}
      {modal}
    </div>
  );
};


const CustomAnchor = ({
  href,
  children,
  attachmentDataUrls = {},
}: {
  href: string;
  children: ReactNode;
  attachmentDataUrls?: Record<string, string>;
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getInternalPathFromHref = (value: string) => {
    const raw = (value || "").trim();
    let normalized = raw;
    try {
      normalized = decodeURIComponent(raw);
    } catch {
      normalized = raw;
    }

    const lowered = normalized.toLowerCase();

    if (lowered.startsWith("/notes/") || lowered.startsWith("/tasks/")) {
      return normalized;
    }

    if (lowered.startsWith("note:") || lowered.startsWith("notes:")) {
      const separator = lowered.startsWith("notes:") ? "notes:" : "note:";
      const id = normalized.slice(separator.length).trim();
      if (!id) return null;
      return `/notes/${id}`;
    }
    if (lowered.startsWith("task:") || lowered.startsWith("tasks:")) {
      const separator = lowered.startsWith("tasks:") ? "tasks:" : "task:";
      const id = normalized.slice(separator.length).trim();
      if (!id) return null;
      return `/tasks/${id}`;
    }
    return null;
  };

  const internalPath = getInternalPathFromHref(href);
  if (internalPath) {
    return (
      <a
        href="#"
        onClick={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await cacheLocation(internalPath, location.pathname || "/chat");
          navigate(internalPath);
        }}
        onAuxClick={(e) => {
          // Prevent middle-click from triggering browser navigation for in-app routes.
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </a>
    );
  }

  const attachmentId = getAttachmentIdFromReference(href);
  if (attachmentId && attachmentDataUrls[attachmentId]) {
    return (
      <a href={attachmentDataUrls[attachmentId]} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  const loweredHref = (href || "").trim().toLowerCase();
  const isExternal =
    loweredHref.startsWith("http://") ||
    loweredHref.startsWith("https://") ||
    loweredHref.startsWith("mailto:") ||
    loweredHref.startsWith("tel:");

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return <a href={href}>{children}</a>;
};

/**
 * Task checkboxes (`- [ ]` / `- [x]`) live inside a node's markdown as one line
 * among possibly several. Toggling one must locate that line within the node's
 * own source (via this node's local AST position offsets) and patch just that
 * line, then hand the whole node content back to the caller.
 */
const Tasky = ({
  node,
  nodeMarkdown,
  onNodeContentChange,
  children,
  className,
}: {
  children?: ReactNode;
  node: any;
  nodeMarkdown: string;
  onNodeContentChange?: (newMarkdown: string) => void;
  className?: string;
}) => {
  const start = node?.position?.start?.offset;
  const end = node?.position?.end?.offset;
  const hasOffsets = typeof start === "number" && typeof end === "number";
  const originalSlice = hasOffsets ? nodeMarkdown.slice(start, end) : "";
  const inputNode = findTaskCheckboxNode(node);
  const sourceChecked = getTaskCheckedFromListItemSource(originalSlice);
  const astChecked =
    inputNode != null ? Boolean(inputNode?.properties?.checked) : sourceChecked ?? false;
  const [overrideChecked, setOverrideChecked] = useState<boolean | null>(null);

  useEffect(() => {
    setOverrideChecked(null);
  }, [originalSlice]);

  const isChecked = overrideChecked ?? astChecked;

  const taskBody = (
    <div className="flex-row align-start gap-5">
      <input
        className="checkbox"
        type="checkbox"
        tabIndex={-1}
        checked={isChecked}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => {
          const next = e.target.checked;
          setOverrideChecked(next);
          if (onNodeContentChange && hasOffsets && originalSlice) {
            const updatedSlice = replaceTaskCheckboxInListItemSource(
              originalSlice,
              next
            );
            if (updatedSlice !== originalSlice) {
              const updatedNode =
                nodeMarkdown.slice(0, start) +
                updatedSlice +
                nodeMarkdown.slice(end);
              onNodeContentChange(updatedNode);
            } else {
              setOverrideChecked(null);
            }
          }
        }}
      />
      <div
        className="task-list-item-body"
        data-checked={isChecked ? "true" : "false"}
        style={{ flex: 1, minWidth: 0 }}
      >
        {children}
      </div>
    </div>
  );

  return (
    <InsideListItemContext.Provider value={true}>
      <li className={className}>{taskBody}</li>
    </InsideListItemContext.Provider>
  );
};

const MermaidBlock = ({ code }: { code: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderIdRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 10)}`);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const renderDiagram = async () => {
      if (!containerRef.current) return;
      try {
        ensureMermaidInitialized();
        const { svg } = await mermaid.render(renderIdRef.current, code);
        if (!mounted || !containerRef.current) return;
        containerRef.current.innerHTML = svg;
        setHasError(false);
      } catch (error) {
        if (!mounted) return;
        setHasError(true);
        console.error("Failed to render Mermaid diagram", error);
      }
    };
    renderDiagram();
    return () => {
      mounted = false;
    };
  }, [code]);

  if (hasError) {
    return (
      <div className="markdown-code-block">
        <pre>{code}</pre>
      </div>
    );
  }

  return <div className="markdown-mermaid-block" ref={containerRef} />;
};

const CustomCode = ({ node }: { node: any }) => {
  const { t } = useTranslation();
  const languageClassName = node?.children?.[0]?.properties?.className?.[0] || "";
  const language = String(languageClassName).replace("language-", "") || "code";
  const codeText = node?.children?.[0]?.children?.[0]?.value || "";
  const [isExpanded, setIsExpanded] = useState(false);
  const codeLines = codeText.split("\n");
  const hasMoreThanTenLines = codeLines.length > 10;
  const visibleCode = hasMoreThanTenLines && !isExpanded
    ? codeLines.slice(0, 10).join("\n")
    : codeText;

  if (language.toLowerCase() === "mermaid") {
    return <MermaidBlock code={codeText} />;
  }

  const copyToClipboard = () => {
    if (codeText) {
      navigator.clipboard.writeText(codeText).then(() => {
        toast.success(t("codeCopied"));
      });
    }
  };

  return (
    <div className="markdown-code-block">
      <div className="markdown-code-header">
        <span className="markdown-code-language">{language}</span>
        <div className="flex-row gap-5">
          {hasMoreThanTenLines && (
            <Button
              className="padding-5 markdown-code-copy"
              title={isExpanded ? t("collapse") : t("expand")}
              text={isExpanded ? t("collapse") : t("expand")}
              onClick={() => setIsExpanded((prev) => !prev)}
            />
          )}
          <Button
            className="padding-5 markdown-code-copy"
            title={t("copyCode")}
            svg={SVGS.copy}
            onClick={copyToClipboard}
          />
        </div>
      </div>
      <pre>
        <code>{visibleCode}</code>
      </pre>
    </div>
  );
};

/**
 * Renders a note as a list of independently-editable nodes. Each node is
 * exactly one markdown block; editing/AI/delete act on a whole node
 * (addressed by id), never on positions within one — a node whose content
 * happens to parse into several markdown blocks (e.g. a manual multi-paragraph
 * paste) still renders all of it, just without per-sub-block actions.
 */
export const RenderNoteNodes = ({
  nodes,
  editableBlocks = false,
  onNodeChange,
  onNodeInsert,
  onNodeDelete,
  onGenerateBlockImage,
}: {
  nodes: TNode[];
  editableBlocks?: boolean;
  onNodeChange?: (nodeId: string, newMarkdown: string) => void;
  onNodeInsert?: (afterNodeId: string | null, newMarkdown: string, nodeType?: TNodeType, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onGenerateBlockImage?: TGenerateBlockImage;
}) => {
  return (
    <ActiveInlineEditProvider onNodeChange={onNodeChange}>
      {nodes.map((node, index) => (
        <NodeBlock
          key={node.id}
          node={node}
          previousNodeId={index > 0 ? nodes[index - 1].id : null}
          editableBlocks={editableBlocks}
          onNodeChange={onNodeChange}
          onNodeInsert={onNodeInsert}
          onNodeDelete={onNodeDelete}
          onGenerateBlockImage={onGenerateBlockImage}
        />
      ))}
      {editableBlocks && onNodeInsert && nodes.length === 0 && (
        <MarkdownInsertZone afterNodeId={null} onNodeInsert={onNodeInsert} variant="end" />
      )}
    </ActiveInlineEditProvider>
  );
};

/**
 * Grid editor for a table node. Parses the node's markdown into headers/rows,
 * renders one input per cell, and re-serializes the whole table back to
 * markdown on every edit — the node's `content` stays plain GFM markdown,
 * this is purely a nicer way to read/write it than the raw-text editor.
 *
 * Keeps its own local `table` state (synced from `content` when the node
 * changes elsewhere) instead of re-deriving it from `content` on every
 * render. Re-deriving meant structural edits (add/remove row/column) and a
 * still-pending debounced cell edit could both read a stale closure of the
 * table and race to overwrite each other — e.g. deleting column 0 while a
 * keystroke in another cell was still debouncing would have the pending
 * keystroke's stale (pre-delete) table win once its timer fired, silently
 * reverting the delete and leaving indices misaligned for the next click.
 */
const TableNodeEditor = ({
  content,
  onChange,
}: {
  content: string;
  onChange: (newMarkdown: string) => void;
}) => {
  const { t } = useTranslation();
  const parseTable = (raw: string): TParsedTable =>
    parseMarkdownTable(raw) ?? { headers: [""], rows: [[""]] };

  const [table, setTable] = useState<TParsedTable>(() => parseTable(content));
  const lastContentRef = useRef(content);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Re-sync from `content` only when it changed for a reason other than our
  // own commit (e.g. the AI assistant updated this node) — avoids clobbering
  // in-progress local edits on every parent re-render.
  if (content !== lastContentRef.current) {
    lastContentRef.current = content;
    setTable(parseTable(content));
  }

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, []);

  const commit = (next: TParsedTable) => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = undefined;
    }
    setTable(next);
    const markdown = serializeMarkdownTable(next);
    lastContentRef.current = markdown;
    onChange(markdown);
  };

  const commitDebounced = (next: TParsedTable) => {
    setTable(next);
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      pendingTimerRef.current = undefined;
      const markdown = serializeMarkdownTable(next);
      lastContentRef.current = markdown;
      onChange(markdown);
    }, 400);
  };

  const setHeaderCell = (col: number, value: string) => {
    commitDebounced({
      ...table,
      headers: table.headers.map((h, i) => (i === col ? value : h)),
    });
  };

  const setBodyCell = (row: number, col: number, value: string) => {
    commitDebounced({
      ...table,
      rows: table.rows.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? value : c)) : r
      ),
    });
  };

  const addRow = () => {
    commit({
      ...table,
      rows: [...table.rows, table.headers.map(() => "")],
    });
  };

  const removeRow = (row: number) => {
    commit({
      ...table,
      rows: table.rows.filter((_, ri) => ri !== row),
    });
  };

  const addColumn = () => {
    commit({
      headers: [...table.headers, `Column ${table.headers.length + 1}`],
      rows: table.rows.map((r) => [...r, ""]),
    });
  };

  const removeColumn = (col: number) => {
    commit({
      headers: table.headers.filter((_, i) => i !== col),
      rows: table.rows.map((r) => r.filter((_, i) => i !== col)),
    });
  };

  const columnCount = table.headers.length;

  return (
    <div className="table-node-editor" onClick={(e) => e.stopPropagation()}>
      <div className="table-node-scroll">
        <table className="table-node-grid">
          <thead>
            <tr>
              {table.headers.map((header, col) => (
                <th key={col}>
                  <div className="table-node-cell">
                    <input
                      className="table-node-input table-node-input--header"
                      value={header}
                      placeholder={t("title")}
                      onChange={(e) => setHeaderCell(col, e.target.value)}
                    />
                    <Tooltip label={t("delete")} withArrow openDelay={400} position="top">
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="red"
                        tabIndex={-1}
                        className="table-node-cell-action"
                        disabled={table.headers.length <= 1}
                        onClick={() => removeColumn(col)}
                        aria-label={t("delete")}
                      >
                        {SVGS.trash}
                      </ActionIcon>
                    </Tooltip>
                  </div>
                </th>
              ))}
              <th className="table-node-add-col-cell" rowSpan={table.rows.length + 1}>
                <button
                  type="button"
                  tabIndex={-1}
                  className="table-node-add-strip-button"
                  title={t("addColumn")}
                  aria-label={t("addColumn")}
                  onClick={addColumn}
                >
                  {SVGS.plus}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>
                    <input
                      className="table-node-input"
                      value={cell}
                      onChange={(e) => setBodyCell(ri, ci, e.target.value)}
                    />
                  </td>
                ))}
                <td className="table-node-row-action-cell">
                  <Tooltip label={t("delete")} withArrow openDelay={400} position="top">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      tabIndex={-1}
                      disabled={table.rows.length <= 1}
                      onClick={() => removeRow(ri)}
                      aria-label={t("delete")}
                    >
                      {SVGS.trash}
                    </ActionIcon>
                  </Tooltip>
                </td>
              </tr>
            ))}
            <tr className="table-node-add-row-row">
              <td colSpan={columnCount + 1}>
                <button
                  type="button"
                  tabIndex={-1}
                  className="table-node-add-strip-button"
                  title={t("addRow")}
                  aria-label={t("addRow")}
                  onClick={addRow}
                >
                  {SVGS.plus}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const NodeBlock = ({
  node,
  previousNodeId = null,
  editableBlocks = false,
  onNodeChange,
  onNodeInsert,
  onNodeDelete,
  onGenerateBlockImage,
}: {
  node: TNode;
  previousNodeId?: string | null;
  editableBlocks?: boolean;
  onNodeChange?: (nodeId: string, newMarkdown: string) => void;
  onNodeInsert?: (afterNodeId: string | null, newMarkdown: string, nodeType?: TNodeType, nodeId?: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onGenerateBlockImage?: TGenerateBlockImage;
}) => {
  const { t } = useTranslation();
  const inlineEdit = useActiveInlineEdit();
  const [modalMode, setModalMode] = useState<TBlockEditorMode | null>(null);
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isEditingText = inlineEdit?.session?.nodeId === node.id;
  const displayMarkdown = isEditingText
    ? inlineEdit!.session!.revertTo
    : node.content;

  const openModal = (mode: "edit-ai" | "edit-image") => {
    setDraftMarkdown(node.content);
    setModalMode(mode);
  };

  const openInlineEdit = () => {
    if (!inlineEdit) return;
    setConfirmDelete(false);
    inlineEdit.startEdit(node.id, node.content);
  };

  const saveModalChanges = (overrideValue?: string) => {
    onNodeChange?.(node.id, overrideValue ?? draftMarkdown);
    setModalMode(null);
  };

  const deleteBlock = () => {
    if (isEditingText) {
      inlineEdit?.discard();
    }
    onNodeDelete?.(node.id);
    setDraftMarkdown("");
    setModalMode(null);
    setConfirmDelete(false);
  };

  const insertTextAt = (afterNodeId: string | null) => {
    if (!onNodeInsert) return;
    setConfirmDelete(false);
    const nodeId = generateRandomId("node");
    onNodeInsert(afterNodeId, "", "markdown", nodeId);
    inlineEdit?.startEdit(nodeId, "");
  };

  const body =
    node.type === "table" ? (
      <TableNodeEditor
        content={node.content}
        onChange={(next) => onNodeChange?.(node.id, next)}
      />
    ) : (
      <RenderMarkdown
        markdown={displayMarkdown}
        onNodeContentChange={(next) => onNodeChange?.(node.id, next)}
      />
    );

  if (!editableBlocks) {
    return body;
  }

  const isTable = node.type === "table";

  return (
    <EditableBlockShell
      isEditing={isEditingText}
      confirmDelete={confirmDelete}
      onEditText={isTable ? undefined : openInlineEdit}
      onRequestDelete={() => setConfirmDelete(true)}
      onConfirmDelete={deleteBlock}
      onCancelDelete={() => setConfirmDelete(false)}
      onInsertAfter={onNodeInsert ? () => insertTextAt(node.id) : undefined}
      onInsertBefore={onNodeInsert ? () => insertTextAt(previousNodeId) : undefined}
      ariaLabel={t("editAsText")}
      actions={
        <BlockActionBar
          onEditText={isTable ? undefined : openInlineEdit}
          onEditAI={() => openModal("edit-ai")}
          onEditImage={isTable ? undefined : () => openModal("edit-image")}
          onDelete={confirmDelete ? deleteBlock : () => setConfirmDelete(true)}
          confirmDelete={confirmDelete}
          onCancelDelete={() => setConfirmDelete(false)}
          onGenerateBlockImage={isTable ? undefined : onGenerateBlockImage}
          blockMarkdown={node.content}
        />
      }
      insertZone={
        onNodeInsert ? (
          <MarkdownInsertZone afterNodeId={node.id} onNodeInsert={onNodeInsert} />
        ) : null
      }
      modal={
        <MarkdownBlockEditorModal
          opened={modalMode != null}
          originalMarkdown={node.content}
          draftMarkdown={draftMarkdown}
          onChange={setDraftMarkdown}
          onSave={saveModalChanges}
          onCancel={() => {
            setModalMode(null);
            setConfirmDelete(false);
          }}
          onDelete={deleteBlock}
          onGenerateBlockImage={isTable ? undefined : onGenerateBlockImage}
          initialMode={modalMode ?? "edit-ai"}
        />
      }
    >
      {isEditingText && inlineEdit?.session ? (
        <InlineBlockTextEditor
          initialDraft={node.content}
          onSaveDraft={inlineEdit.flushDraft}
          onFinish={inlineEdit.finish}
          onCancel={inlineEdit.cancel}
        />
      ) : (
        body
      )}
    </EditableBlockShell>
  );
};

/** Renders one node's markdown content as its own independent react-markdown document. */
export const RenderMarkdown = ({
  markdown,
  onNodeContentChange,
}: {
  markdown: string;
  onNodeContentChange?: (newMarkdown: string) => void;
}) => {
  const { t } = useTranslation();
  const displayMarkdown = markdown;
  const [attachmentDataUrls, setAttachmentDataUrls] = useState<Record<string, string>>({});
  const [imageJobs, setImageJobs] = useState<TImageJobMap>({});

  useEffect(() => {
    const attachmentReferences = Array.from(
      displayMarkdown.matchAll(/attachments?:([A-Za-z0-9_-]+)/gi)
    );
    const attachmentIds = Array.from(
      new Set(attachmentReferences.map((match) => match[1]).filter(Boolean))
    );

    if (attachmentIds.length === 0) {
      setAttachmentDataUrls({});
      setImageJobs({});
      return;
    }

    // Listen to storage only while some referenced attachment is missing —
    // a background image job may still produce it. Once everything resolves
    // there is nothing to wait for.
    let mounted = true;
    let listening = false;

    const onStorageChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string
    ) => {
      if (areaName !== "local") return;
      if (changes.attachments || changes[AI_IMAGE_JOBS_KEY]) {
        void hydrateAttachments();
      }
    };

    const startListening = () => {
      if (listening) return;
      chrome.storage.onChanged.addListener(onStorageChanged);
      listening = true;
    };

    const stopListening = () => {
      if (!listening) return;
      chrome.storage.onChanged.removeListener(onStorageChanged);
      listening = false;
    };

    const hydrateAttachments = async () => {
      try {
        const [attachments, jobs] = await Promise.all([
          ChromeStorageManager.get("attachments") as Promise<TAttachment[]>,
          getImageJobs(),
        ]);
        if (!mounted) return;

        const nextMap: Record<string, string> = {};
        attachmentIds.forEach((attachmentId) => {
          const attachment = (attachments || []).find(
            (item) => item.id === attachmentId
          );
          if (attachment?.dataUrl) {
            nextMap[attachmentId] = attachment.dataUrl;
          }
        });
        setAttachmentDataUrls(nextMap);
        setImageJobs(jobs);

        const hasPendingWork = attachmentIds.some(
          (attachmentId) =>
            !nextMap[attachmentId] &&
            jobs[attachmentId]?.status === "pending" &&
            !isImageJobStale(jobs[attachmentId])
        );
        if (hasPendingWork) {
          startListening();
        } else {
          stopListening();
        }
      } catch (error) {
        console.error("Could not read attachments from storage", error);
        if (mounted) {
          setAttachmentDataUrls({});
        }
      }
    };

    hydrateAttachments();
    return () => {
      mounted = false;
      stopListening();
    };
  }, [displayMarkdown]);

  return (
    <>
      <Markdown
        skipHtml={true}
        urlTransform={markdownUrlTransform}
        components={{
          input: (props) => {
            if (props.type === "checkbox") {
              return null;
            }
            return <input {...props} />;
          },
          a: (props) => {
            return (
              <CustomAnchor
                href={props.href || ""}
                attachmentDataUrls={attachmentDataUrls}
              >
                {props.children}
              </CustomAnchor>
            );
          },
          img: (props) => {
            const src = props.src || "";
            const attachmentId = getAttachmentIdFromReference(src);
            const resolvedSrc = attachmentId ? attachmentDataUrls[attachmentId] : src;

            if (!resolvedSrc) {
              const job = attachmentId ? imageJobs[attachmentId] : undefined;
              if (job?.status === "pending" && !isImageJobStale(job)) {
                return (
                  <span className="ai-image-placeholder">
                    <Loader size="xs" color="var(--font-color)" />
                    {props.alt || t("generatingImage")}
                  </span>
                );
              }
              if (job) {
                return (
                  <span className="ai-image-placeholder ai-image-placeholder-error">
                    {t("imageGenerationFailed")}
                    {job.error ? `: ${job.error}` : ""}
                  </span>
                );
              }
              return null;
            }

            return (
              <img
                src={resolvedSrc}
                alt={props.alt || "attachment"}
                style={{ maxWidth: "100%", borderRadius: "8px" }}
              />
            );
          },
          pre: (props) => <CustomCode node={props.node} />,
          li: (props) => {
            if (hasTaskListItemClassName(props.className)) {
              return (
                <Tasky
                  className={stringifyLiClassName(props.className)}
                  node={props.node}
                  nodeMarkdown={displayMarkdown}
                  onNodeContentChange={onNodeContentChange}
                >
                  {props.children}
                </Tasky>
              );
            }
            return <li>{props.children}</li>;
          },
          p: (props) => <p>{props.children}</p>,
          h1: (props) => <h1>{props.children}</h1>,
          h2: (props) => <h2>{props.children}</h2>,
          h3: (props) => <h3>{props.children}</h3>,
          h4: (props) => <h4>{props.children}</h4>,
          h5: (props) => <h5>{props.children}</h5>,
          h6: (props) => <h6>{props.children}</h6>,
          blockquote: (props) => <blockquote>{props.children}</blockquote>,
          hr: () => <hr />,
        }}
        remarkPlugins={[remarkGfm]}
      >
        {displayMarkdown}
      </Markdown>
    </>
  );
};
