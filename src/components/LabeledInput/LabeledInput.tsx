export const LabeledInput = ({
  label,
  type,
  name,
  value,
  placeholder = "",
  className = "",
  required = false,
  onChange = () => {},
}: {
  label: string;
  type: string;
  name: string;
  value?: string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) => {
  return (
    <div className={`labeled-input ${className}`}>
      <label htmlFor={name}>{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
      />
    </div>
  );
};
