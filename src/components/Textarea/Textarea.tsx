import { useEffect, useRef, useState } from "react";
import { SVGS } from "../../assets/svgs";
import { Button } from "../Button/Button";
import { StyledMarkdown } from "../RenderMarkdown/StyledMarkdown";

type TTextareaProps = {
  defaultValue?: string;
  name?: string;
  onChange?: (value: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  maxHeight?: string;
  isMarkdown?: boolean;
};

const MarkdownEditor = ({
  defaultValue,
  onChange,
}: {
  defaultValue: string;
  onChange: (value: string) => void;
}) => {
  const [markdown, setMarkdown] = useState(defaultValue);
  console.log(onChange);

  return (
    <StyledMarkdown
      markdown={markdown}
      onChange={(value) => setMarkdown(value)}
    />
  );
};

export const Textarea = ({
  defaultValue = "",
  name = "textarea",
  onChange = () => {},
  className,
  label,
  placeholder,
  maxHeight = "200px",
  isMarkdown = false,
}: TTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"markdown" | "plain">("plain");
  //   adjust the height of the textarea to the content when the user is typing

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [defaultValue]);

  useEffect(() => {
    if (isMarkdown) {
      setMode("markdown");
    }
  }, [isMarkdown]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [mode]);

  return (
    <div className="labeled-textarea w-100">
      <label>{label} </label>
      {isMarkdown && (
        <div>
          <Button
            svg={mode === "markdown" ? SVGS.markdown : SVGS.text}
            onClick={() => setMode(mode === "markdown" ? "plain" : "markdown")}
            className="w-100"
          />
        </div>
      )}
      {mode === "markdown" ? (
        <MarkdownEditor
          defaultValue={defaultValue}
          onChange={(value) => {
            console.log(value);
            onChange(value);
          }}
        />
      ) : (
        <textarea
          placeholder={placeholder}
          name={name}
          ref={textareaRef}
          style={{
            overflowY: "auto",
            resize: "none",
            scrollbarWidth: "none",
            maxHeight: maxHeight,
          }}
          onInput={() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = "auto";
              textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
            }
          }}
          className={`textarea ${className}`}
          defaultValue={defaultValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
};
