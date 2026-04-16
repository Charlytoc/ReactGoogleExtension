import { SVGS } from "../../assets/svgs";
import { Button } from "../Button/Button";

type SectionProps = {
  children: React.ReactNode;
  close?: () => void;
  headerLeft?: React.ReactNode;
  headerCenter?: React.ReactNode;
  headerRight?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

export const Section = ({
  close = undefined,
  children,
  headerLeft,
  headerCenter,
  headerRight,
  className,
  style = { backgroundColor: "var(--bg-color)" },
}: SectionProps) => {
  const hasHeader = headerLeft || headerCenter || headerRight || close;
  return (
    <div className={`absolute-container ${className}`} style={style}>
      {hasHeader && (
        <section
          className="flex-row gap-10 align-center justify-between padding-10"
          style={{ position: "relative", flexShrink: 0 }}
        >
          <div style={{ flex: "1 1 0%", minWidth: 0 }}>{headerLeft}</div>
          {headerCenter && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                pointerEvents: "auto",
              }}
            >
              {headerCenter}
            </div>
          )}
          <div className="flex-row gap-5" style={{ flexShrink: 0 }}>
            {headerRight}
            {close && (
              <Button className="padding-5" svg={SVGS.back} onClick={close} />
            )}
          </div>
        </section>
      )}
      <div className="section-content">{children}</div>
    </div>
  );
};
