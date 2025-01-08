import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { cacheLocation } from "../../utils/lib";

export const Content = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div>
      <div className="content-container">
        <div className="flex-row gap-10 justify-center padding-10 botonera">
          <Button
            text={t("chat")}
            className="padding-20  border-gray rounded"
            svg={SVGS.chat}
            onClick={() => {
              cacheLocation("/chat");
              navigate("/chat");
            }}
          />
          <Button
            text={t("snapties")}
            className="padding-20  border-gray rounded"
            svg={SVGS.clip}
            onClick={() => {
              cacheLocation("/snapties");
              navigate("/snapties");
            }}
          />
          <Button
            text={t("notes")}
            className="padding-20   border-gray rounded"
            svg={SVGS.note}
            onClick={() => {
              cacheLocation("/notes");
              navigate("/notes");
            }}
          />
          <Button
            text={t("tasks")}
            className="padding-20  border-gray rounded"
            svg={SVGS.task}
            onClick={() => {
              cacheLocation("/tasks");
              navigate("/tasks");
            }}
          />

          <Button
            text={t("config")}
            className="padding-20  border-gray rounded"
            svg={SVGS.gear}
            onClick={() => {
              cacheLocation("/config");
              navigate("/config");
            }}
          />
        </div>
      </div>
    </div>
  );
};
