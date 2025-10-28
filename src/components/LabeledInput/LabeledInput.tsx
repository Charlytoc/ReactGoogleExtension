import { useRef } from "react";
import { SVGS } from "../../assets/svgs";
import { Button } from "../Button/Button";
import { createCompletion } from "../../utils/ai";
import { ChromeStorageManager } from "../../managers/Storage";

const FILL_PROMPT = (currentValue: string, inputData: string) => `
You are a powerful form assistant. YOur task is to help the user fill a form.
The current value of the input is: ${currentValue}.

All this data is related to this unique input:
---
${inputData}
---

You will need to fill the input with the data provided.

The input is a text input.

Generate a value that fits the input and is related to the data provided.


`;

export const LabeledInput = ({
  label,
  type,
  name,
  value,
  defaultValue,
  placeholder = "",
  className = "",
  autoFocus = false,
  required = false,
  onChange = () => {},
  onKeyDown = () => {},
  readOnly = false,
  aiButton = false,
  getAIContext = () => "",
  fillPrompt = FILL_PROMPT,
}: {
  label: string;
  type: string;
  name: string;
  autoFocus?: boolean;
  value?: string;
  defaultValue?: string | number;
  defaultChecked?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  required?: boolean;
  aiButton?: boolean;
  getAIContext?: () => string;
  onChange?: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  fillPrompt?: (currentValue: string, inputData: string) => string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  // const { colors } = useContext(ColorContext);

  const handleAIButton = async () => {
    const allAvailableContext = `

    ${getAIContext()}


    ### Information about the input:
    label: ${label}
    type: ${type}
    name: ${name}
    value: ${value}
    defaultValue: ${defaultValue}
    placeholder: ${placeholder}

    required: ${required}
    readOnly: ${readOnly}

    You should return only the new value for the input following the instructions very carefully.
    `;

    const apiKey = await ChromeStorageManager.get("openaiApiKey");

    const systemPrompt = fillPrompt(
      inputRef.current?.value || "",
      allAvailableContext
    );
    await createCompletion(
      {
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: inputRef.current?.value || "",
          },
        ],
        model: "gpt-4o-mini",
        response_format: { type: "text" },
        temperature: 0.5,
        max_completion_tokens: 100,
        apiKey,
      },
      (completion) => {
        console.log(completion);
        if (inputRef.current) {
          inputRef.current.value = completion.choices[0].message.content || "";
          onChange?.(inputRef.current?.value || "");
        }
      }
    );

    // if (inputRef.current && response) {
    //   inputRef.current.value = response;
    // }
  };

  return (
    <div className={`labeled-input ${className}`}>
      <label htmlFor={name} className="color-secondary">
        {label}
      </label>
      <input
        autoFocus={autoFocus}
        ref={inputRef}
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={onKeyDown}
        required={required}
        readOnly={readOnly}
      />
      {aiButton && (
        <Button
          className="active-on-hover"
          title="AI"
          svg={SVGS.ai}
          onClick={handleAIButton}
        />
      )}
    </div>
  );
};
