import { SVGS } from "../../assets/svgs";
import { TNote } from "../../types";
import { Button } from "../Button/Button";
import "./Note.css";

import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { saveLastPage } from "../../utils/lib";
type TNoteProps = TNote & {
  deleteNote?: () => void;
};

export const Note = ({
  title,
  deleteNote,
  id,
  color = "var(--bg-color)",
}: TNoteProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div
      style={{ backgroundColor: color }}
      className="border-gray padding-10 rounded note"
    >
      <h4>{title}</h4>
      <div className="flex-row gap-10 justify-center ">
        <Button
          className="w-100 justify-center padding-5"
          svg={SVGS.trash}
          text={""}
          onClick={deleteNote}
          confirmations={[{ text: t("sure?"), className: "bg-danger" }]}
        />
        <Button
          className="w-100 justify-center padding-5 active-on-hover"
          svg={SVGS.expand}
          // text={t("expand")}
          onClick={() => {
            saveLastPage(`/notes/${id}`);
            navigate(`/notes/${id}`);
          }}
        />
      </div>
    </div>
  );
};
