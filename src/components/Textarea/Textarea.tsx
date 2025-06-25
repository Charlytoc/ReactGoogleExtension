import { useEffect, useRef, useState } from "react";
import { SVGS } from "../../assets/svgs";
import { Button } from "../Button/Button";
import { StyledMarkdown } from "../RenderMarkdown/StyledMarkdown";
// import useDebounce from "../../hooks/useDebounce";
// import toast from "react-hot-toast";

type TTextareaProps = {
  defaultValue?: string;
  name?: string;
  onChange?: (value: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  maxHeight?: string;
  isMarkdown?: boolean;
  onKeyUp?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
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

// const defaultAutoCompletions = [
//   "Hello",
//   "World",
//   "This is a test",
//   "This is another test",
// ];

export const Textarea = ({
  defaultValue = "",
  name = "textarea",
  onChange = () => {},
  className,
  label,
  placeholder,
  maxHeight = "200px",
  isMarkdown = false,
  onKeyUp = () => {},
}: TTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"markdown" | "plain">("plain");

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }

    if (!defaultValue && textareaRef.current) {
      textareaRef.current.value = "";
    }
  }, [defaultValue]);

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
        <>
          <textarea
            placeholder={placeholder}
            name={name}
            ref={textareaRef}
            style={{
              overflowY: "auto",
              resize: "none",
              scrollbarWidth: "none",
              minHeight: "100px",
              maxHeight: maxHeight,
            }}
            onInput={() => {
              if (textareaRef.current) {
                textareaRef.current.style.height = "auto";
                textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
              }
            }}
            className={`${className}`}
            defaultValue={defaultValue}
            onChange={(e) => {
              onChange(e.target.value);
            }}
            onKeyUp={(e) => {
              onKeyUp(e);
            }}
          />
          {/* {autoCompletions.map((completion) => (
            <Button
              text={completion}
              key={completion}
              onClick={() => {
                if (textareaRef.current) {
                  textareaRef.current.value += completion;
                  onChange(textareaRef.current.value);
                }
              }}
            />
          ))} */}
        </>
      )}
    </div>
  );
};
