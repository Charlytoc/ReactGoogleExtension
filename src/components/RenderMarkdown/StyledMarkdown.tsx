import { RenderMarkdown, RenderNoteNodes, TGenerateBlockImage } from "./RenderMarkdown";
import type { TNode } from "../../types";

/** Read-only markdown rendering for a plain string (chat messages, previews). */
export const StyledMarkdown = ({ markdown }: { markdown: string }) => {
  return (
    <div className="markdown-container">
      <RenderMarkdown markdown={markdown} />
    </div>
  );
};

/** Editable per-node rendering for a note's node list. */
export const StyledNoteNodes = ({
  nodes,
  editableBlocks = false,
  onNodeChange,
  onNodeConvert,
  onNodeInsert,
  onNodeDelete,
  onGenerateBlockImage,
}: {
  nodes: TNode[];
  editableBlocks?: boolean;
  onNodeChange?: (nodeId: string, newMarkdown: string) => void;
  /** Changes a node's type (and its content to match), e.g. a blank text node becoming a table/image. */
  onNodeConvert?: (nodeId: string, nodeType: TNode["type"], content: string) => void;
  onNodeInsert?: (
    afterNodeId: string | null,
    newMarkdown: string,
    nodeType?: TNode["type"],
    nodeId?: string
  ) => void;
  onNodeDelete?: (nodeId: string) => void;
  onGenerateBlockImage?: TGenerateBlockImage;
}) => {
  return (
    <div className="markdown-container markdown-container--editable">
      <RenderNoteNodes
        nodes={nodes}
        editableBlocks={editableBlocks}
        onNodeChange={onNodeChange}
        onNodeConvert={onNodeConvert}
        onNodeInsert={onNodeInsert}
        onNodeDelete={onNodeDelete}
        onGenerateBlockImage={onGenerateBlockImage}
      />
    </div>
  );
};
