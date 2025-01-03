import { useEffect, useRef } from "react";

export const Textarea = ({
  defaultValue,
  onChange,
}: {
  defaultValue: string;
  onChange: (value: string) => void;
}) => {
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
      className="input w-100"
      defaultValue={defaultValue}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};
