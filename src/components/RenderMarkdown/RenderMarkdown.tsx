import { ReactNode, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { Textarea } from "@mantine/core";
import { useShallow } from "zustand/shallow";
import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import { createCompletion } from "../../utils/ai";
import { MODEL_CHAT_SMALL } from "../../utils/models";
import { useStore } from "../../managers/store";
import { AIInput } from "../AIInput/AIInput";
import { useLocation, useNavigate } from "react-router";
import { cacheLocation } from "../../utils/lib";
import { ChromeStorageManager } from "../../managers/Storage";
import { TAttachment } from "../../types";

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

type TBlockEditorMode = "preview" | "edit-text" | "edit-ai";

const MarkdownBlockEditorModal = ({
  opened,
  originalMarkdown,
  draftMarkdown,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  opened: boolean;
  originalMarkdown: string;
  draftMarkdown: string;
  onChange: (value: string) => void;
  onSave: (overrideValue?: string) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) => {
  const { t } = useTranslation();
  const apiKey = useStore(useShallow((s) => s.config.auth.openaiApiKey));
  const [mode, setMode] = useState<TBlockEditorMode>("preview");
  const [aiInstruction, setAiInstruction] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (opened) setMode("preview");
  }, [opened]);

  if (!opened) return null;

  const handleApplyAI = async () => {
    if (!aiInstruction.trim()) return;
    setIsApplying(true);
    try {
      const effectiveApiKey =
        apiKey || ((await ChromeStorageManager.get("openaiApiKey")) ?? "");
      if (!effectiveApiKey) {
        toast.error("Missing OpenAI API key");
        return;
      }
      const result = await createCompletion(
        {
          messages: [
            {
              role: "system",
              content: `You are a markdown editor assistant. The user will give you a markdown block and an instruction. Return ONLY the updated markdown for that block, with no explanation, no code fences, and no extra commentary.`,
            },
            {
              role: "user",
              content: `Block:\n${originalMarkdown}\n\nInstruction: ${aiInstruction}`,
            },
          ],
          model: MODEL_CHAT_SMALL,
          temperature: 0.4,
          max_completion_tokens: 2000,
          response_format: { type: "text" },
          apiKey: effectiveApiKey,
        },
        () => {}
      );
      setAiInstruction("");
      onSave(result ?? originalMarkdown);
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
                title={t("editAsText")}
                text={t("editAsText")}
                svg={SVGS.edit}
                onClick={() => {
                  onChange(originalMarkdown);
                  setMode("edit-text");
                }}
              />
              <Button
                className="padding-5"
                title={t("editWithAI")}
                text={t("editWithAI")}
                svg={SVGS.ai}
                onClick={() => setMode("edit-ai")}
              />
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
            <Textarea
              autosize
              maxRows={Math.floor((window.innerHeight * 0.8) / 24)}
              value={draftMarkdown}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  setMode("preview");
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSave();
                }
              }}
              autoFocus
              styles={{
                input: {
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  background: "transparent",
                  color: "var(--font-color)",
                  border: "1px solid var(--opaque-gray-color)",
                  borderRadius: "6px",
                },
              }}
            />
            <div className="flex-row gap-5">
              <Button className="padding-5" title={t("save")} svg={SVGS.check} onClick={onSave} />
              <Button
                className="padding-5"
                title={t("back")}
                svg={SVGS.back}
                onClick={() => setMode("preview")}
              />
            </div>
          </>
        )}

        {mode === "edit-ai" && (
          <>
            <div className="markdown-block-preview">
              <RenderMarkdown markdown={originalMarkdown} editableBlocks={false} />
            </div>
            <AIInput
              value={aiInstruction}
              onChange={setAiInstruction}
              onSubmit={handleApplyAI}
              onEscape={() => setMode("preview")}
              isLoading={isApplying}
              placeholder={t("instruction")}
              autoFocus
              multiline
            />
            <Button
              className="padding-5"
              title={t("back")}
              svg={SVGS.back}
              onClick={() => setMode("preview")}
            />
          </>
        )}
      </div>
    </div>
  );
};

const BlockEditAsText = ({
  sourceMarkdown,
  node,
  editableBlocks = false,
  onBlockChange,
  children,
}: {
  sourceMarkdown: string;
  node: any;
  editableBlocks?: boolean;
  onBlockChange?: (range: TOffsets, newMarkdown: string) => void;
  children: ReactNode;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const offsets = getOffsets(node);
  const originalMarkdown = getNodeTextFromOffsets(sourceMarkdown, node);

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
  };

  if (!editableBlocks || !offsets) {
    return <>{children}</>;
  }

  return (
    <div className="markdown-block-row">
      <div
        className="markdown-block-content"
        onClick={(e) => {
          if (!e.shiftKey) return;
          e.preventDefault();
          e.stopPropagation();
          setDraftMarkdown(originalMarkdown);
          setIsEditing(true);
        }}
      >
        {children}
      </div>
      <MarkdownBlockEditorModal
        opened={isEditing}
        originalMarkdown={originalMarkdown}
        draftMarkdown={draftMarkdown}
        onChange={setDraftMarkdown}
        onSave={saveChanges}
        onCancel={() => setIsEditing(false)}
        onDelete={deleteBlock}
      />
    </div>
  );
};

const ListItemEditAsText = ({
  sourceMarkdown,
  node,
  editableBlocks = false,
  onBlockChange,
  children,
}: {
  sourceMarkdown: string;
  node: any;
  editableBlocks?: boolean;
  onBlockChange?: (range: TOffsets, newMarkdown: string) => void;
  children: ReactNode;
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draftMarkdown, setDraftMarkdown] = useState("");
  const offsets = getOffsets(node);
  const originalMarkdown = getNodeTextFromOffsets(sourceMarkdown, node);

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
  };

  if (!editableBlocks || !offsets) {
    return <li>{children}</li>;
  }

  return (
    <li>
      <div className="markdown-block-row">
        <div
          className="markdown-block-content"
          onClick={(e) => {
            if (!e.shiftKey) return;
            e.preventDefault();
            e.stopPropagation();
            setDraftMarkdown(originalMarkdown);
            setIsEditing(true);
          }}
        >
          {children}
        </div>
        <MarkdownBlockEditorModal
          opened={isEditing}
          originalMarkdown={originalMarkdown}
          draftMarkdown={draftMarkdown}
          onChange={setDraftMarkdown}
          onSave={saveChanges}
          onCancel={() => setIsEditing(false)}
          onDelete={deleteBlock}
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
  const inputNode = node.children.find(
    (child: any) => child.type === "element" && child.tagName === "input"
  );

  const astChecked = Boolean(inputNode?.properties?.checked);
  const [overrideChecked, setOverrideChecked] = useState<boolean | null>(null);

  const offsets = getOffsets(node);
  const originalSlice =
    offsets != null ? getNodeTextFromOffsets(sourceMarkdown, node) : "";

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
}: {
  markdown: string;
  editableBlocks?: boolean;
  onBlockChange?: (range: TOffsets, newMarkdown: string) => void;
}) => {
  const [attachmentDataUrls, setAttachmentDataUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const attachmentReferences = Array.from(
      markdown.matchAll(/attachments?:([A-Za-z0-9_-]+)/gi)
    );
    const attachmentIds = Array.from(
      new Set(attachmentReferences.map((match) => match[1]).filter(Boolean))
    );

    if (attachmentIds.length === 0) {
      setAttachmentDataUrls({});
      return;
    }

    let mounted = true;
    const hydrateAttachments = async () => {
      try {
        const attachments: TAttachment[] =
          (await ChromeStorageManager.get("attachments")) || [];
        if (!mounted) return;

        const nextMap: Record<string, string> = {};
        attachmentIds.forEach((attachmentId) => {
          const attachment = attachments.find((item) => item.id === attachmentId);
          if (attachment?.dataUrl) {
            nextMap[attachmentId] = attachment.dataUrl;
          }
        });
        setAttachmentDataUrls(nextMap);
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
    };
  }, [markdown]);

  return (
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
          >
            <blockquote>{props.children}</blockquote>
          </BlockEditAsText>
        ),
      }}
      remarkPlugins={[remarkGfm]}
    >
      {markdown}
    </Markdown>
  );
};
