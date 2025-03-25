import { SVGS } from "../../assets/svgs";
import { Button } from "../Button/Button";

type SectionProps = {
  children: React.ReactNode;
  close?: () => void;
  headerLeft?: React.ReactNode;
  headerRight?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

export const Section = ({
  close = undefined,
  children,
  headerLeft,
  headerRight,
  className,
  style = { backgroundColor: "var(--bg-color)" },
}: SectionProps) => {
  return (
    <div className={`absolute-container ${className}`} style={style}>
      <section className="flex-row gap-10 align-center justify-between padding-10">
        {headerLeft}
        <div className="flex-row gap-5">
          {headerRight}
          {close && (
            <Button className="padding-5" svg={SVGS.back} onClick={close} />
          )}
        </div>
      </section>
      <div className="section-content">{children}</div>
    </div>
  );
};
