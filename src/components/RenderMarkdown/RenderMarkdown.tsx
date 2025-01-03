import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export const RenderMarkdown = ({ markdown }: { markdown: string }) => {
  return <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>;
};
