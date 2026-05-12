import { TagsInput } from "@mantine/core";
import { parseTagsInput } from "../../utils/tags";

export type TagsFieldProps = {
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  hint?: string;
  disabled?: boolean;
};

/**
 * Tag editor with Mantine-styled suggestion dropdown (not HTML `<datalist>`, which is browser-native).
 */
export function TagsField({
  label,
  value,
  onChange,
  suggestions = [],
  hint,
  disabled,
}: TagsFieldProps) {
  return (
    <TagsInput
      label={label}
      description={hint}
      value={value}
      onChange={(tags) => onChange(parseTagsInput(tags.join(",")))}
      data={suggestions}
      disabled={disabled}
      clearable
      autoComplete="off"
      splitChars={[","]}
      placeholder="Add tags"
      size="sm"
      maxDropdownHeight={280}
    />
  );
}
