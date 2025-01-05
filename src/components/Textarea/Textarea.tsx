import { useEffect, useRef } from "react";

type TTextareaProps = {
  defaultValue?: string;
  name?: string;
  onChange: (value: string) => void;
  className?: string;
};

export const Textarea = ({
  defaultValue = "",
  name = "textarea",
  onChange,
  className,
}: TTextareaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  //   adjust the height of the textarea to the content when the user is typing

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [defaultValue]);
  return (
    <textarea
      name={name}
      ref={textareaRef}
      style={{
        overflow: "hidden",
        resize: "none",
        scrollbarWidth: "none",
      }}
      onInput={() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      }}
      className={`w-100 textarea ${className}`}
      defaultValue={defaultValue}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};
