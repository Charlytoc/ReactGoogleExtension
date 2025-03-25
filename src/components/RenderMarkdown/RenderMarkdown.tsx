import { ReactNode, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
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

const Tasky = ({ children, node }: { children: ReactNode; node: any }) => {
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

const CustomCode = ({ children, node }: { children: ReactNode; node: any }) => {
  const { t } = useTranslation();

  const copyToClipboard = () => {
    const codeText = node.children[0]?.children[0]?.value || "";
    if (codeText) {
      navigator.clipboard.writeText(codeText).then(() => {
        console.log("Código copiado al portapapeles");
        toast.success(t("codeCopied"));
      });
    }
  };

  return (
    <div>
      <button onClick={copyToClipboard}>Copiar</button>
      <pre>{children}</pre>
    </div>
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
        pre: (props) => {
          console.log(props.node, "pre");

          return <CustomCode node={props.node}>{props.children}</CustomCode>;
        },
        li: (props) => {
          if (props.className === "task-list-item") {
            return <Tasky node={props.node}>{props.children}</Tasky>;
          }
          return <li>{props.children}</li>;
        },
      }}
      remarkPlugins={[remarkGfm]}
    >
      {markdown}
    </Markdown>
  );
};
