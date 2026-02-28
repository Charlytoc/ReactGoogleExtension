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
import { useStore } from "../../managers/store";
import { AIInput } from "../AIInput/AIInput";
import { useLocation, useNavigate } from "react-router";
import { cacheLocation } from "../../utils/lib";

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
    lowered.startsWith("tasks:")
  ) {
    return normalized;
  }
  return defaultUrlTransform(normalized);
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
const getNodeTextFromOffsets = (source: string, node: any) => {
  const offsets = getOffsets(node);
  if (!offsets) return "";
  return source.slice(offsets.start, offsets.end);
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
          model: "gpt-4o-mini",
          temperature: 0.4,
          max_completion_tokens: 2000,
          response_format: { type: "text" },
          apiKey,
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
}: {
  href: string;
  children: ReactNode;
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

const Tasky = ({ node }: { children: ReactNode; node: any }) => {
  const inputNode = node.children.find(
    (child: any) => child.type === "element" && child.tagName === "input"
  );

  const textNodes = node.children.filter((child: any) => child.type === "text");
  const pNodes = node.children.filter(
    (child: any) => child.type === "element" && child.tagName === "p"
  );

  const [isChecked, setIsChecked] = useState(false);

  useEffect(() => {
    setIsChecked(inputNode?.properties?.checked ?? false);
  }, [inputNode]);

  return (
    <li>
      <div className="flex-row align-center gap-5">
        <input
          className="checkbox"
          type="checkbox"
          defaultChecked={isChecked}
          onChange={(e) => {
            setIsChecked(e.target.checked);
          }}
        />
        <span
          style={{
            textDecorationColor: "var(--active-color)",
            textDecorationStyle: "wavy",
            textDecorationLine: isChecked ? "line-through" : "none",
          }}
        >
          {pNodes.length > 0
            ? pNodes.map((pNode: any) =>
                pNode.children.map((child: any) => child.value).join(" ")
              )
            : textNodes.map((textNode: any) => textNode.value).join(" ")}
        </span>
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
  return (
    <Markdown
      skipHtml={true}
      urlTransform={markdownUrlTransform}
      components={{
        a: (props) => {
          return (
            <CustomAnchor href={props.href || ""}>
              {props.children}
            </CustomAnchor>
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
          if (props.className === "task-list-item") {
            return <Tasky node={props.node}>{props.children}</Tasky>;
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
