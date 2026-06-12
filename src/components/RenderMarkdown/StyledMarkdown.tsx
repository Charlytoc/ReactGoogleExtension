import { RenderMarkdown, TGenerateBlockImage } from "./RenderMarkdown";

export const StyledMarkdown = ({
  markdown,
  editableBlocks = false,
  onBlockChange,
  onGenerateBlockImage,
}: {
  markdown: string;
  editableBlocks?: boolean;
  onBlockChange?: (
    range: { start: number; end: number },
    newMarkdown: string
  ) => void;
  onGenerateBlockImage?: TGenerateBlockImage;
}) => {
  return (
    <div className="markdown-container">
      <RenderMarkdown
        markdown={markdown}
        editableBlocks={editableBlocks}
        onBlockChange={onBlockChange}
        onGenerateBlockImage={onGenerateBlockImage}
      />
    </div>
  );
};
