import { SVGS } from "../../assets/svgs";
import { Button } from "../Button/Button";

type SectionProps = {
  close: () => void;
  children: React.ReactNode;
};

export const Section = ({ close, children }: SectionProps) => {
  return (
    <div className="section absolute-container bg-default">
      <Button className="section-closer padding-5" svg={SVGS.close} onClick={close} />
      <div className="section-content">{children}</div>
    </div>
  );
};
