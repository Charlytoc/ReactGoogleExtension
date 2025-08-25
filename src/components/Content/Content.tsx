import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { cacheLocation } from "../../utils/lib";

export const Content = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div className="content-container">
      <div className="flex-row gap-10 justify-center padding-10 botonera">
        <Button
          text={t("chat")}
          className="padding-20 active-on-hover border-gray rounded font-bold"
          svg={SVGS.chat}
          onClick={() => {
            cacheLocation("/chat");
            navigate("/chat");
          }}
        />
        <Button
          text={t("snapties")}
          className="padding-20 active-on-hover border-gray rounded font-bold"
          svg={SVGS.pin}
          onClick={() => {
            cacheLocation("/snapties");
            navigate("/snapties");
          }}
        />
        <Button
          text={t("notes")}
          className="padding-20 active-on-hover border-gray rounded font-bold"
          svg={SVGS.note}
          onClick={() => {
            cacheLocation("/notes");
            navigate("/notes");
          }}
        />
        <Button
          text={t("tasks")}
          className="padding-20 border-gray rounded active-on-hover font-bold"
          svg={SVGS.task}
          onClick={() => {
            cacheLocation("/tasks");
            navigate("/tasks");
          }}
        />
        {/* <Button
          text={t("calendar")}
          className="padding-20 active-on-hover border-gray rounded font-bold"
          svg={SVGS.calendar2}
          onClick={() => {
            cacheLocation("/calendar");
            navigate("/calendar");
          }}
        /> */}
        <Button
          text={t("config")}
          className="padding-20 active-on-hover border-gray rounded font-bold"
          svg={SVGS.gear}
          onClick={() => {
            cacheLocation("/config");
            navigate("/config");
          }}
        />
      </div>
    </div>
  );
};
