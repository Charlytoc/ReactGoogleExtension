import { useState } from "react";
import "./Button.css";

type TConfirmation = {
  text: string;
  svg?: React.ReactNode;
  className?: string;
};

type ButtonProps = {
  svg?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  text?: string;
  confirmations?: TConfirmation[];
  title?: string;
  type?: "button" | "submit" | "reset";
  usesAI?: boolean;
};

export const Button = ({
  svg = null,
  onClick = () => {},
  className = "",
  text = "",
  confirmations = [],
  title = "",
  type = "button",
  // usesAI = false,
}: ButtonProps) => {
  const [timesClicked, setTimesClicked] = useState(0);

  const handleClick = () => {
    if (timesClicked === confirmations.length) {
      onClick();
      setTimesClicked(0);
    } else {
      setTimesClicked(timesClicked + 1);
    }
  };

  return (
    <button
      type={type}
      title={title}
      tabIndex={0}
      className={`button ${className} ${
        confirmations.length === 0 || timesClicked === 0
          ? ""
          : confirmations[timesClicked - 1]?.className
      }`}
      onClick={handleClick}
    >
      {/* {usesAI && <span className="text-mini float-right">AI</span>} */}
      {svg && (
        <span className="svg-container">
          {confirmations.length === 0 || timesClicked === 0
            ? svg
            : confirmations[timesClicked - 1]?.svg}
        </span>
      )}

      {(timesClicked === 0 || confirmations.length === 0) && text ? (
        <span>{text}</span>
      ) : (
        confirmations[timesClicked - 1]?.text && (
          <span>{confirmations[timesClicked - 1]?.text}</span>
        )
      )}
    </button>
  );
};
