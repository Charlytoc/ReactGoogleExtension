import { useEffect, useState } from "react";

type TOption = {
  label: string;
  value: string;
};

export const Select = ({
  options,
  defaultValue,
  onChange,
  name,
  className,
  id,
  required,
}: {
  options: TOption[];
  defaultValue: string;
  onChange?: (value: string) => void;
  name: string;
  className?: string;
  id?: string;
  required?: boolean;
}) => {
  const [innerValue, setInnerValue] = useState(defaultValue);

  useEffect(() => {
    const option = options.find((option) => option.value === defaultValue);
    if (option) {
      setInnerValue(option.value);
    }
  }, [defaultValue, options]);

  return (
    <select
      value={innerValue}
      onChange={(e) => {
        setInnerValue(e.target.value);
        onChange && onChange(e.target.value);
      }}
      className={`color-normal rounded bg-default padding-5 ${className} `}
      id={id}
      name={name}
      required={required}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};
