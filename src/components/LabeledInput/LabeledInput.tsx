export const LabeledInput = ({
  label,
  type,
  name,
  placeholder = "",
  className = "",
  required = false,
  onChange = () => {},
}: {
  label: string;
  type: string;
  name: string;
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
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
      />
    </div>
  );
};
