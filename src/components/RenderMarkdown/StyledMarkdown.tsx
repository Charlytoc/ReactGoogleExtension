import { RenderMarkdown } from "./RenderMarkdown";

export const StyledMarkdown = ({
  markdown,
  onChange,
}: {
  markdown: string;
  onChange?: (value: string) => void;
}) => {
  console.log(onChange);
  return (
    <div className="markdown-container">
      <RenderMarkdown markdown={markdown} />
    </div>
  );
};
