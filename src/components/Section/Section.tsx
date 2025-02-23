import { SVGS } from "../../assets/svgs";
import { Button } from "../Button/Button";

type SectionProps = {
  children: React.ReactNode;
  close?: () => void;
  title: string;
  extraButtons?: React.ReactNode;
};

export const Section = ({
  close = undefined,
  children,
  title,
  extraButtons,
}: SectionProps) => {
  return (
    <div className="absolute-container bg-gradient">
      <section className="flex-row gap-10 align-center justify-between padding-10">
        <h3 className="font-mono">{title}</h3>
        <div className="flex-row gap-5">
          {extraButtons}
          {close && (
            <Button className="padding-5" svg={SVGS.back} onClick={close} />
          )}
        </div>
      </section>
      <div className="section-content">{children}</div>
    </div>
  );
};
