import { MouseEvent, ReactNode, useEffect, useRef, useState } from "react";
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
import { MODEL_CHAT_CAPABLE } from "../../utils/models";
import { useStore } from "../../managers/store";
import { useLocation, useNavigate } from "react-router";
import { cacheLocation } from "../../utils/lib";
import { ChromeStorageManager } from "../../managers/Storage";
import { TAttachment } from "../../types";
import {
  AI_IMAGE_JOBS_KEY,
  getImageJobs,
  isImageJobStale,
  type TImageJobMap,
} from "../../utils/imageJobs";

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

type TOffsets = {
  start: number;
  end: number;
};

const getOffsets = (node: any): TOffsets | null => {
  const start = node?.position?.start?.offset;
  const end = node?.position?.end?.offset;
  if (typeof start !== "number" || typeof end !== "number") return null;
  return { start, end };
};

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
const getNodeTextFromOffsets = (source: string, node: any) => {
  const offsets = getOffsets(node);
  if (!offsets) return "";
  return source.slice(offsets.start, offsets.end);
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

const formatBlockInsertion = (
  sourceMarkdown: string,
  insertAt: number,
  text: string
): string => {
  const trimmed = text.trim();
  if (!trimmed) return "";

  if (insertAt === 0 && sourceMarkdown.length === 0) {
    return trimmed;
  }

  const before = sourceMarkdown.slice(0, insertAt);
  if (before.endsWith("\n\n")) {
    return trimmed;
  }
  if (before.endsWith("\n")) {
    return `\n${trimmed}`;
  }
  return `\n\n${trimmed}`;
};

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
          model: MODEL_CHAT_CAPABLE,
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
              <RenderMarkdown markdown={originalMarkdown} editableBlocks={false} />
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
                <RenderMarkdown markdown={originalMarkdown} editableBlocks={false} />
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
                <RenderMarkdown markdown={originalMarkdown} editableBlocks={false} />
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

const MarkdownInsertZone = ({
  sourceMarkdown,
  insertAt,
  onBlockChange,
  onGenerateBlockImage,
  variant = "between",
}: {
  sourceMarkdown: string;
  insertAt: number;
  onBlockChange?: (range: TOffsets, newMarkdown: string) => void;
  onGenerateBlockImage?: TGenerateBlockImage;
  variant?: "between" | "end";
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState("");

  const openInsert = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraftMarkdown("");
    setIsOpen(true);
  };

  const saveInsert = (overrideValue?: string) => {
    const insertion = formatBlockInsertion(
      sourceMarkdown,
      insertAt,
      overrideValue ?? draftMarkdown
    );
    if (!insertion) {
      setIsOpen(false);
      return;
    }
    onBlockChange?.({ start: insertAt, end: insertAt }, insertion);
    setDraftMarkdown("");
    setIsOpen(false);
  };

  return (
    <>
      <div
        className={`markdown-insert-zone${
          variant === "end" ? " markdown-insert-zone--end" : ""
        }`}
      >
        <button
          type="button"
          className={`markdown-insert-zone-button${
            variant === "end" ? " markdown-insert-zone-button--end" : ""
          }`}
          title={t("insertBlock")}
          aria-label={t("insertBlock")}
          onClick={openInsert}
        >
          {SVGS.plus}
          {variant === "end" ? (
            <span className="markdown-insert-zone-label">{t("insertBlock")}</span>
          ) : null}
        </button>
      </div>
      <MarkdownBlockEditorModal
        opened={isOpen}
        originalMarkdown=""
        draftMarkdown={draftMarkdown}
        onChange={setDraftMarkdown}
        onSave={saveInsert}
        onCancel={() => {
          setIsOpen(false);
          setDraftMarkdown("");
        }}
        onGenerateBlockImage={onGenerateBlockImage}
        initialMode="edit-text"
      />
    </>
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
  onEditText: () => void;
  onEditAI: () => void;
  onEditImage: () => void;
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
    <div className="markdown-block-actions">
      {confirmDelete ? (
        <>
          <Tooltip label={t("sure?")} withArrow openDelay={150} position="top">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="red"
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
              onClick={onCancelDelete}
              aria-label={t("goBack")}
            >
              {SVGS.close}
            </ActionIcon>
          </Tooltip>
        </>
      ) : (
        <>
          <Tooltip label={t("editAsText")} withArrow openDelay={400} position="top">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={onEditText}
              aria-label={t("editAsText")}
            >
              {SVGS.edit}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("editWithAI")} withArrow openDelay={400} position="top">
            <ActionIcon
              size="sm"
              variant="subtle"
              color="grape"
              onClick={onEditAI}
              aria-label={t("editWithAI")}
            >
              {SVGS.ai}
            </ActionIcon>
          </Tooltip>
          {onGenerateBlockImage && (
            <Tooltip label={t("generateImage")} withArrow openDelay={400} position="top">
              <ActionIcon
                size="sm"
                variant="subtle"
                color="blue"
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

const BlockEditAsText = ({
  sourceMarkdown,
  node,
  editableBlocks = false,
  onBlockChange,
  onGenerateBlockImage,
  children,
}: {
  sourceMarkdown: string;
  node: any;
  editableBlocks?: boolean;
  onBlockChange?: (range: TOffsets, newMarkdown: string) => void;
  onGenerateBlockImage?: TGenerateBlockImage;
  children: ReactNode;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [initialMode, setInitialMode] = useState<TBlockEditorMode>("edit-text");
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const offsets = getOffsets(node);
  const originalMarkdown = getNodeTextFromOffsets(sourceMarkdown, node);

  const openModal = (mode: TBlockEditorMode) => {
    setDraftMarkdown(originalMarkdown);
    setInitialMode(mode);
    setIsEditing(true);
  };

  const saveChanges = (overrideValue?: string) => {
    if (!offsets) return;
    onBlockChange?.(offsets, overrideValue ?? draftMarkdown);
    setIsEditing(false);
  };
  const deleteBlock = () => {
    if (!offsets) return;
    onBlockChange?.(offsets, "");
    setDraftMarkdown("");
    setIsEditing(false);
    setConfirmDelete(false);
  };

  if (!editableBlocks || !offsets) {
    return <>{children}</>;
  }

  const showInsertZone =
    onBlockChange != null && offsets.end < sourceMarkdown.length;

  return (
    <div className="markdown-block-row">
      <div className="markdown-block-content">
        {children}
      </div>
      <BlockActionBar
        onEditText={() => openModal("edit-text")}
        onEditAI={() => openModal("edit-ai")}
        onEditImage={() => openModal("edit-image")}
        onDelete={confirmDelete ? deleteBlock : () => setConfirmDelete(true)}
        confirmDelete={confirmDelete}
        onCancelDelete={() => setConfirmDelete(false)}
        onGenerateBlockImage={onGenerateBlockImage}
        blockMarkdown={originalMarkdown}
      />
      {showInsertZone && (
        <MarkdownInsertZone
          sourceMarkdown={sourceMarkdown}
          insertAt={offsets.end}
          onBlockChange={onBlockChange}
          onGenerateBlockImage={onGenerateBlockImage}
        />
      )}
      <MarkdownBlockEditorModal
        opened={isEditing}
        originalMarkdown={originalMarkdown}
        draftMarkdown={draftMarkdown}
        onChange={setDraftMarkdown}
        onSave={saveChanges}
        onCancel={() => { setIsEditing(false); setConfirmDelete(false); }}
        onDelete={deleteBlock}
        onGenerateBlockImage={onGenerateBlockImage}
        initialMode={initialMode}
      />
    </div>
  );
};

const ListItemEditAsText = ({
  sourceMarkdown,
  node,
  editableBlocks = false,
  onBlockChange,
  onGenerateBlockImage,
  children,
}: {
  sourceMarkdown: string;
  node: any;
  editableBlocks?: boolean;
  onBlockChange?: (range: TOffsets, newMarkdown: string) => void;
  onGenerateBlockImage?: TGenerateBlockImage;
  children: ReactNode;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [initialMode, setInitialMode] = useState<TBlockEditorMode>("edit-text");
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const offsets = getOffsets(node);
  const originalMarkdown = getNodeTextFromOffsets(sourceMarkdown, node);

  const openModal = (mode: TBlockEditorMode) => {
    setDraftMarkdown(originalMarkdown);
    setInitialMode(mode);
    setIsEditing(true);
  };

  const saveChanges = (overrideValue?: string) => {
    if (!offsets) return;
    onBlockChange?.(offsets, overrideValue ?? draftMarkdown);
    setIsEditing(false);
  };
  const deleteBlock = () => {
    if (!offsets) return;
    onBlockChange?.(offsets, "");
    setDraftMarkdown("");
    setIsEditing(false);
    setConfirmDelete(false);
  };

  if (!editableBlocks || !offsets) {
    return <li>{children}</li>;
  }

  return (
    <li>
      <div className="markdown-block-row">
        <div className="markdown-block-content">
          {children}
        </div>
        <BlockActionBar
          onEditText={() => openModal("edit-text")}
          onEditAI={() => openModal("edit-ai")}
          onEditImage={() => openModal("edit-image")}
          onDelete={confirmDelete ? deleteBlock : () => setConfirmDelete(true)}
          confirmDelete={confirmDelete}
          onCancelDelete={() => setConfirmDelete(false)}
          onGenerateBlockImage={onGenerateBlockImage}
          blockMarkdown={originalMarkdown}
        />
        <MarkdownBlockEditorModal
          opened={isEditing}
          originalMarkdown={originalMarkdown}
          draftMarkdown={draftMarkdown}
          onChange={setDraftMarkdown}
          onSave={saveChanges}
          onCancel={() => { setIsEditing(false); setConfirmDelete(false); }}
          onDelete={deleteBlock}
          onGenerateBlockImage={onGenerateBlockImage}
          initialMode={initialMode}
        />
      </div>
    </li>
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

const Tasky = ({
  node,
  sourceMarkdown,
  onBlockChange,
  children,
  className,
}: {
  children?: ReactNode;
  node: any;
  sourceMarkdown: string;
  onBlockChange?: (range: TOffsets, newMarkdown: string) => void;
  className?: string;
}) => {
  const offsets = getOffsets(node);
  const originalSlice =
    offsets != null ? getNodeTextFromOffsets(sourceMarkdown, node) : "";
  const inputNode = findTaskCheckboxNode(node);
  const sourceChecked = getTaskCheckedFromListItemSource(originalSlice);
  const astChecked =
    inputNode != null ? Boolean(inputNode?.properties?.checked) : sourceChecked ?? false;
  const [overrideChecked, setOverrideChecked] = useState<boolean | null>(null);

  useEffect(() => {
    setOverrideChecked(null);
  }, [originalSlice]);

  const isChecked = overrideChecked ?? astChecked;

  return (
    <li className={className}>
      <div className="flex-row align-start gap-5">
        <input
          className="checkbox"
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            const next = e.target.checked;
            setOverrideChecked(next);
            if (onBlockChange && offsets && originalSlice) {
              const updated = replaceTaskCheckboxInListItemSource(originalSlice, next);
              if (updated !== originalSlice) {
                onBlockChange(offsets, updated);
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
    </li>
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

export const RenderMarkdown = ({
  markdown,
  editableBlocks = false,
  onBlockChange,
  onGenerateBlockImage,
}: {
  markdown: string;
  editableBlocks?: boolean;
  onBlockChange?: (range: TOffsets, newMarkdown: string) => void;
  onGenerateBlockImage?: TGenerateBlockImage;
}) => {
  const { t } = useTranslation();
  const [attachmentDataUrls, setAttachmentDataUrls] = useState<Record<string, string>>({});
  const [imageJobs, setImageJobs] = useState<TImageJobMap>({});

  useEffect(() => {
    const attachmentReferences = Array.from(
      markdown.matchAll(/attachments?:([A-Za-z0-9_-]+)/gi)
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
  }, [markdown]);

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
        pre: (props) => {
          return (
            <BlockEditAsText
              sourceMarkdown={markdown}
              node={props.node}
              editableBlocks={editableBlocks}
              onBlockChange={onBlockChange}
              onGenerateBlockImage={onGenerateBlockImage}
            >
              <CustomCode node={props.node} />
            </BlockEditAsText>
          );
        },
        li: (props) => {
          if (hasTaskListItemClassName(props.className)) {
            return (
              <Tasky
                className={stringifyLiClassName(props.className)}
                node={props.node}
                sourceMarkdown={markdown}
                onBlockChange={onBlockChange}
              >
                {props.children}
              </Tasky>
            );
          }
          return (
            <ListItemEditAsText
              sourceMarkdown={markdown}
              node={props.node}
              editableBlocks={editableBlocks}
              onBlockChange={onBlockChange}
              onGenerateBlockImage={onGenerateBlockImage}
            >
              {props.children}
            </ListItemEditAsText>
          );
        },
        p: (props) => {
          return (
            <BlockEditAsText
              sourceMarkdown={markdown}
              node={props.node}
              editableBlocks={editableBlocks}
              onBlockChange={onBlockChange}
              onGenerateBlockImage={onGenerateBlockImage}
            >
              <p>{props.children}</p>
            </BlockEditAsText>
          );
        },
        h1: (props) => (
          <BlockEditAsText
            sourceMarkdown={markdown}
            node={props.node}
            editableBlocks={editableBlocks}
            onBlockChange={onBlockChange}
            onGenerateBlockImage={onGenerateBlockImage}
          >
            <h1>{props.children}</h1>
          </BlockEditAsText>
        ),
        h2: (props) => (
          <BlockEditAsText
            sourceMarkdown={markdown}
            node={props.node}
            editableBlocks={editableBlocks}
            onBlockChange={onBlockChange}
            onGenerateBlockImage={onGenerateBlockImage}
          >
            <h2>{props.children}</h2>
          </BlockEditAsText>
        ),
        h3: (props) => (
          <BlockEditAsText
            sourceMarkdown={markdown}
            node={props.node}
            editableBlocks={editableBlocks}
            onBlockChange={onBlockChange}
            onGenerateBlockImage={onGenerateBlockImage}
          >
            <h3>{props.children}</h3>
          </BlockEditAsText>
        ),
        h4: (props) => (
          <BlockEditAsText
            sourceMarkdown={markdown}
            node={props.node}
            editableBlocks={editableBlocks}
            onBlockChange={onBlockChange}
            onGenerateBlockImage={onGenerateBlockImage}
          >
            <h4>{props.children}</h4>
          </BlockEditAsText>
        ),
        h5: (props) => (
          <BlockEditAsText
            sourceMarkdown={markdown}
            node={props.node}
            editableBlocks={editableBlocks}
            onBlockChange={onBlockChange}
            onGenerateBlockImage={onGenerateBlockImage}
          >
            <h5>{props.children}</h5>
          </BlockEditAsText>
        ),
        h6: (props) => (
          <BlockEditAsText
            sourceMarkdown={markdown}
            node={props.node}
            editableBlocks={editableBlocks}
            onBlockChange={onBlockChange}
            onGenerateBlockImage={onGenerateBlockImage}
          >
            <h6>{props.children}</h6>
          </BlockEditAsText>
        ),
        blockquote: (props) => (
          <BlockEditAsText
            sourceMarkdown={markdown}
            node={props.node}
            editableBlocks={editableBlocks}
            onBlockChange={onBlockChange}
            onGenerateBlockImage={onGenerateBlockImage}
          >
            <blockquote>{props.children}</blockquote>
          </BlockEditAsText>
        ),
      }}
      remarkPlugins={[remarkGfm]}
    >
      {markdown}
    </Markdown>
    {editableBlocks && onBlockChange && (
      <MarkdownInsertZone
        sourceMarkdown={markdown}
        insertAt={markdown.length}
        onBlockChange={onBlockChange}
        onGenerateBlockImage={onGenerateBlockImage}
        variant="end"
      />
    )}
    </>
  );
};
