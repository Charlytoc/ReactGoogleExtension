import { useState } from "react";
import { Tooltip } from "@mantine/core";
import "./Button.css";

type TConfirmation = {
  text: string;
  svg?: React.ReactNode;
  className?: string;
};

type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> & {
  svg?: React.ReactNode;
  onClick?: () => void;
  text?: string;
  confirmations?: TConfirmation[];
  usesAI?: boolean;
};

export const Button = ({
  svg = null,
  onClick = () => {},
  text = "",
  confirmations = [],
  usesAI = false,
  ...nativeButtonProps
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

  // Extract className from native props and merge
  const { className: nativeClassName, title: nativeTitle, ...restNativeProps } =
    nativeButtonProps;
  const mergedClassName = `button ${nativeClassName || ""} ${
    confirmations.length === 0 || timesClicked === 0
      ? ""
      : confirmations[timesClicked - 1]?.className
  }`;

  const buttonNode = (
    <button
      {...restNativeProps}
      type={restNativeProps.type || "button"}
      className={mergedClassName}
      onClick={handleClick}
      aria-label={
        typeof nativeTitle === "string"
          ? nativeTitle
          : (restNativeProps["aria-label"] as string | undefined)
      }
    >
      {/* {usesAI && <span className="text-mini float-right">AI</span>} */}
      {(confirmations.length > 0 && timesClicked > 0
        ? confirmations[timesClicked - 1]?.svg
        : svg) && (
        <span className="svg-container">
          {confirmations.length > 0 && timesClicked > 0
            ? confirmations[timesClicked - 1]?.svg
            : svg}
        </span>
      )}

      {(timesClicked === 0 || confirmations.length === 0) && text ? (
        <span className="text-target">{text}</span>
      ) : (
        confirmations[timesClicked - 1]?.text && (
          <span className="text-target">{confirmations[timesClicked - 1]?.text}</span>
        )
      )}
    </button>
  );

  if (typeof nativeTitle === "string" && nativeTitle.trim().length > 0) {
    return (
      <Tooltip label={nativeTitle} withArrow openDelay={250}>
        {buttonNode}
      </Tooltip>
    );
  }

  return buttonNode;
};
