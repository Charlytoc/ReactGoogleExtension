import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { TTask, TTaskStatus } from "../../types";
import { Button } from "../Button/Button";
import CircularProgress from "../CircularProgress/CircularProgress";
import { cacheLocation, transformToMinutes } from "../../utils/lib";
import { upsertTask } from "./TaskManager";
import { useState } from "react";
import toast from "react-hot-toast";
import { Select } from "../Select/Select";
import { SVGS } from "../../assets/svgs";

const calculateMinutesAgo = (startDatetime: string): number => {
  const startDate = new Date(startDatetime);
  const now = new Date();

  const diffMinutes = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60)
  );

  return diffMinutes;
};

const calculatePercentageDone = (
  totalMinutes: number,
  workedMinutes: number
) => {
  // Keep only the first 3 digits after the decimal point
  const percentage = (workedMinutes / totalMinutes) * 100;
  if (percentage > 100) {
    return 100;
  }

  if (percentage < 0) {
    return 0;
  }

  return Math.round(percentage * 100) / 100;
};

const TaskStadistics = ({
  task,
  reload,
}: {
  task: TTask;
  reload: () => void;
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex-row align-center justify-between">
      <div>
        {isOpen ? (
          <>
            <div>
              {t("startsOn")}{" "}
              {task.startDatetime
                ? new Date(task.startDatetime).toLocaleString()
                : ""}
            </div>
            <div>
              {t("endsOn")}{" "}
              {task.dueDatetime
                ? new Date(task.dueDatetime).toLocaleString()
                : ""}
            </div>
          </>
        ) : (
          <Button text={t("showDetails")} onClick={() => setIsOpen(!isOpen)} />
        )}
        {task.reminderEvery && (
          <div className="">
            <div
              className="flex-row gap-5"
              title={t("alarmTriggeredEvery", {
                minutes: task.reminderEvery,
              })}
            >
              <span>⌛</span>
              <span>{task.reminderEvery}</span>
            </div>
            {task.motivationText && (
              <blockquote className="blockquote">
                <strong>{"☁️"}</strong> {task.motivationText}
              </blockquote>
            )}
          </div>
        )}
      </div>
      {task.startDatetime ? (
        <CircularProgress
          percentage={calculatePercentageDone(
            transformToMinutes(
              task.estimatedTime ? task.estimatedTime : 0,
              task.estimatedTimeUnit ? task.estimatedTimeUnit : "minutes"
            ),
            calculateMinutesAgo(task.startDatetime || "")
          )}
        />
      ) : (
        <Button
          text={t("start")}
          onClick={async () => {
            // If not task.estimatedTime, set it, notify the error to the user
            if (!task.estimatedTime) {
              toast.error(t("estimatedTimeNotSet"));
              return;
            }
            const updatedTask: TTask = {
              ...task,
              startDatetime: new Date().toISOString(),
              status: "IN_PROGRESS",
            };
            await upsertTask(updatedTask, false);
            reload();
          }}
        />
      )}
    </div>
  );
};

export const TaskCard = ({
  task,
  deleteTask,
  reload,
}: {
  task: TTask;
  deleteTask: () => void;
  reload: () => void;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className={`task-card ${task.priority}`}>
      <h2 className="text-center">{task.title}</h2>
      <p className="text-center">{task.description}</p>

      <TaskStadistics task={task} reload={reload} />

      <div className="flex-row gap-5">
        <Button
          className="w-100 justify-center padding-5 border-gray "
          text={t("delete")}
          svg={SVGS.close}
          onClick={deleteTask}
          confirmations={[
            { text: t("sure?"), className: "bg-danger", svg: SVGS.close },
          ]}
        />
        <Button
          className="w-100 justify-center padding-5 active-on-hover border-gray"
          text={t("edit")}
          onClick={() => {
            cacheLocation(`/tasks/${task.id}`, "/tasks");
            navigate(`/tasks/${task.id}`);
          }}
        />

        <Select
          name="status"
          defaultValue={task.status || "TODO"}
          options={[
            { label: t("done"), value: "DONE" },
            { label: t("inProgress"), value: "IN_PROGRESS" },
            { label: t("todo"), value: "TODO" },
          ]}
          onChange={(value) => {
            task.status = value as TTaskStatus;
            upsertTask(task, false);
          }}
        />
      </div>
    </div>
  );
};
