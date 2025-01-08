import { SVGS } from "../../assets/svgs";
import { Button } from "../Button/Button";

type SectionProps = {
  close: () => void;
  children: React.ReactNode;
  title: string;
  extraButtons?: React.ReactNode;
};

export const Section = ({
  close,
  children,
  title,
  extraButtons,
}: SectionProps) => {
  return (
    <div className="absolute-container bg-default ">
      <section className="flex-row gap-10 align-center justify-between padding-10">
        <h3>{title}</h3>
        <div className="flex-row gap-5">
          {extraButtons}
          <Button className="padding-5" svg={SVGS.back} onClick={close} />
        </div>
      </section>
      <div className="section-content">{children}</div>
    </div>
  );
};
