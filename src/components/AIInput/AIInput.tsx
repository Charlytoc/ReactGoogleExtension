import { useTranslation } from "react-i18next";
import { TextInput, Textarea, ActionIcon } from "@mantine/core";
import { SVGS } from "../../assets/svgs";

export const AIInput = ({
  value,
  onChange,
  onSubmit,
  onEscape,
  isLoading = false,
  placeholder,
  autoFocus = false,
  multiline = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onEscape?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  multiline?: boolean;
}) => {
  const { t } = useTranslation();

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

  const sendButton = (
    <ActionIcon
      variant="subtle"
      color="gray"
      onClick={onSubmit}
      loading={isLoading}
      title={t("generate")}
    >
      {SVGS.ai}
    </ActionIcon>
  );

  const sharedProps = {
    placeholder: placeholder ?? t("userMessage"),
    value,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      onChange(e.target.value),
    onKeyDown: handleKeyDown,
    autoFocus,
    disabled: isLoading,
    rightSection: sendButton,
    styles: {
      input: {
        paddingRight: "2.5rem",
      },
    },
  };

  if (multiline) {
    return (
      <Textarea
        {...sharedProps}
        autosize
        minRows={3}
        maxRows={6}
      />
    );
  }

  return <TextInput {...sharedProps} />;
};
