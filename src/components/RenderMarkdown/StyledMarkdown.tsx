import { RenderMarkdown } from "./RenderMarkdown";

export const StyledMarkdown = ({
    markdown,
}: {
  markdown: string;
}) => {
  return (
    <div className="markdown-container">
      <RenderMarkdown markdown={markdown} />
    </div>
  );
};
