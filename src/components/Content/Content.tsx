import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { saveLastPage } from "../../utils/lib";

export const Content = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div>
      <div className="content-container">
        <div className="flex-row gap-10 justify-center padding-10 ">
          <Button
            text={t("notes")}
            className="padding-20 active-on-hover"
            svg={SVGS.note}
            onClick={() => {
              saveLastPage("/notes");
              navigate("/notes");
            }}
          />
          <Button
            text={t("tasks")}
            className="padding-20 active-on-hover"
            svg={SVGS.task}
            onClick={() => {
              saveLastPage("/tasks");
              navigate("/tasks");
            }}
          />
          
          <Button
            className="padding-20 active-on-hover"
            svg={SVGS.config}
            onClick={() => {
              saveLastPage("/config");
              navigate("/config");
            }}
          />
        </div>
      </div>
    </div>
  );
};
