import { ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CustomAnchor = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
};

export const RenderMarkdown = ({ markdown }: { markdown: string }) => {
  return (
    <Markdown
      skipHtml={true}
      components={{
        a: (props) => {
          return (
            <CustomAnchor href={props.href || ""}>
              {props.children}
            </CustomAnchor>
          );
        },
      }}
      remarkPlugins={[remarkGfm]}
    >
      {markdown}
    </Markdown>
  );
};
