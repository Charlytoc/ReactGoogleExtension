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
  onNodeInsert,
  onNodeDelete,
  onGenerateBlockImage,
}: {
  nodes: TNode[];
  editableBlocks?: boolean;
  onNodeChange?: (nodeId: string, newMarkdown: string) => void;
  onNodeInsert?: (afterNodeId: string | null, newMarkdown: string) => void;
  onNodeDelete?: (nodeId: string) => void;
  onGenerateBlockImage?: TGenerateBlockImage;
}) => {
  return (
    <div className="markdown-container">
      <RenderNoteNodes
        nodes={nodes}
        editableBlocks={editableBlocks}
        onNodeChange={onNodeChange}
        onNodeInsert={onNodeInsert}
        onNodeDelete={onNodeDelete}
        onGenerateBlockImage={onGenerateBlockImage}
      />
    </div>
  );
};
