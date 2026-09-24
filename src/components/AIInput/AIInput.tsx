import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { TextInput, Textarea, ActionIcon } from "@mantine/core";
import { IconPaperclip } from "@tabler/icons-react";
import { SVGS } from "../../assets/svgs";

export const AIInput = ({
  value,
  onChange,
  onSubmit,
  onAttachFiles,
  onEscape,
  isLoading = false,
  placeholder,
  autoFocus = false,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onAttachFiles?: (files: File[]) => void;
  onEscape?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  multiline?: boolean;
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === "Escape" && onEscape) {
      e.preventDefault();
      onEscape();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (!onAttachFiles) return;
    const files = Array.from(e.clipboardData.files);
    if (files.length === 0) return;
    e.preventDefault();
    onAttachFiles(files);
  };

  const sendButton = (
    <ActionIcon
      variant="subtle"
      color="gray"
      onClick={onSubmit}
      loading={isLoading}
      disabled={isLoading}
      title={t("generate")}
    >
      {SVGS.ai}
    </ActionIcon>
  );

  const attachButton = onAttachFiles ? (
    <ActionIcon
      variant="subtle"
      color="gray"
      disabled={isLoading}
      title={t("attachFile")}
      onClick={() => fileInputRef.current?.click()}
    >
      <IconPaperclip size={18} />
    </ActionIcon>
  ) : null;

  const sharedProps = {
    placeholder: placeholder ?? t("userMessage"),
    value,
    variant: "filled" as const,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      onChange(e.target.value),
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
    autoFocus,
    disabled: isLoading,
    leftSection: attachButton,
    rightSection: sendButton,
    styles: {
      input: {
        paddingLeft: onAttachFiles ? "2.5rem" : undefined,
        paddingRight: "2.5rem",
      },
    },
  };

  return (
    <>
      {onAttachFiles && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) onAttachFiles(files);
            e.target.value = "";
          }}
        />
      )}
      {multiline ? (
        <Textarea {...sharedProps} autosize minRows={3} maxRows={6} />
      ) : (
        <TextInput {...sharedProps} />
      )}
    </>
  );
};
