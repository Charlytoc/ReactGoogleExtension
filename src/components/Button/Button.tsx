import { useState } from "react";
import "./Button.css";

type TConfirmation = {
  text: string;
  svg?: React.ReactNode;
};

type ButtonProps = {
  svg?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  text?: string;
  confirmations?: TConfirmation[];
};

export const Button = ({
  svg = null,
  onClick = () => {},
  className = "",
  text = "",
  confirmations = [],
}: ButtonProps) => {
  const [timesClicked, setTimesClicked] = useState(0);

  const handleClick = () => {
    if (timesClicked === confirmations.length) {
      onClick();
    } else {
      setTimesClicked(timesClicked + 1);
    }
  };

  return (
    <button
      tabIndex={0}
      className={`button ${className}`}
      onClick={handleClick}
    >
      {svg && (
        <span>
          {confirmations.length === 0 || timesClicked === 0
            ? svg
            : confirmations[timesClicked - 1]?.svg}
        </span>
      )}
      {text && (
        <span>
          {timesClicked === 0 || confirmations.length === 0
            ? text
            : confirmations[timesClicked - 1]?.text}
        </span>
      )}
    </button>
  );
};
