import { SVGS } from "../../assets/svgs";
import { Button } from "../Button/Button";

type SectionProps = {
  close: () => void;
  children: React.ReactNode;
  title: string;
};

export const Section = ({ close, children, title }: SectionProps) => {
  return (
    <div className="section absolute-container bg-default">
      <section className="section-header flex-row gap-10 align-center justify-between padding-10">
        <Button
          className="section-closer padding-5 active-on-hover"
          svg={SVGS.close}
          onClick={close}
        />
        <h3>{title}</h3>
      </section>
      <div className="section-content">{children}</div>
    </div>
  );
};
