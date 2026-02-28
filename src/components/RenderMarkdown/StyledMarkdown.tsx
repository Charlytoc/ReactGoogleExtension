import { RenderMarkdown } from "./RenderMarkdown";

export const StyledMarkdown = ({
  markdown,
  editableBlocks = false,
  onBlockChange,
}: {
  markdown: string;
  editableBlocks?: boolean;
  onBlockChange?: (
    range: { start: number; end: number },
    newMarkdown: string
  ) => void;
}) => {
  return (
    <div className="markdown-container">
      <RenderMarkdown
        markdown={markdown}
        editableBlocks={editableBlocks}
        onBlockChange={onBlockChange}
      />
    </div>
  );
};
