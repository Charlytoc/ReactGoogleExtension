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
  return (
    <select
      defaultValue={defaultValue}
      onChange={(e) => onChange && onChange(e.target.value)}
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
