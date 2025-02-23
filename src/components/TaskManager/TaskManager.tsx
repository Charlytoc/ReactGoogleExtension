import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import "./TaskManager.css";
import { useNavigate } from "react-router";
import {
  cacheLocation,
  generateRandomId,
  transformToMinutes,
} from "../../utils/lib";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { TTask } from "../../types";

import { ChromeStorageManager } from "../../managers/Storage";
import {
  clearAlarm,
  clearAllAlarms,
  createAlarm,
  notify,
} from "../../utils/chromeFunctions";
import { Section } from "../Section/Section";
import CircularProgress from "../CircularProgress/CircularProgress";

export const hashText = (text: string) => {
  return text.replace(/\s+/g, "-");
};

export const dateToMilliseconds = (date: string) => {
  return new Date(date).getTime();
};

export const upsertTask = async (task: TTask, alarm = true) => {
  const tasks = await ChromeStorageManager.get("tasks");
  if (tasks) {
    const taskIndex = tasks.findIndex((t: TTask) => t.id === task.id);
    if (taskIndex !== -1) {
      tasks[taskIndex] = task;
      await ChromeStorageManager.add("tasks", tasks);
    } else {
      await ChromeStorageManager.add("tasks", [...tasks, task]);
    }
  } else {
    await ChromeStorageManager.add("tasks", [task]);
  }

  if (alarm) {
    createAlarm(
      task.id,
      task.startDatetime ? dateToMilliseconds(task.startDatetime) : 0,
      task.reminderEvery ? task.reminderEvery : 1000
    );
  }
};

const createRandomTask = async () => {
  const task: TTask = {
    id: generateRandomId("task"),
    title: "",
    description: "",
    startDatetime: undefined,
    dueDatetime: undefined,
    reminderEvery: undefined,
    motivationText: "",
    priority: "low",
    status: "TODO",
    createdAt: new Date().toISOString(),
    estimatedTime: undefined,
    estimatedTimeUnit: "minutes",
  };
  await upsertTask(task, false);
  return task;
};

export const TaskManager = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<TTask[]>([]);
  // const [showForm, setShowForm] = useState(false);

  const navigate = useNavigate();

  const getTasks = async () => {
    const tasks = await ChromeStorageManager.get("tasks");

    if (tasks) {
      setTasks(tasks);
    }
  };

  useEffect(() => {
    getTasks();
  }, []);

  const deleteTask = async (index: number) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    await ChromeStorageManager.add("tasks", newTasks);
    setTasks(newTasks);

    clearAlarm(tasks[index].id);
    notify(t("alarmCancelled"), tasks[index].title);
  };

  const handleCreateRandomTask = async () => {
    const task = await createRandomTask();
    cacheLocation(`/tasks/${task.id}`, "/tasks");
    navigate(`/tasks/${task.id}`);
  };

  return (
    <Section
      title={t("taskManager")}
      close={() => {
        cacheLocation("/index.html", "lastPage");
        navigate("/index.html");
      }}
      extraButtons={
        <>
          <Button
            onClick={handleCreateRandomTask}
            className="justify-center padding-5 "
            svg={SVGS.plus}
          />

          <Button
            onClick={() => {
              clearAllAlarms();
              notify(t("allAlarmsCleared"), "");
            }}
            className="justify-center padding-5 "
            title={t("clearAllAlarms")}
            svg={SVGS.alarmOff}
            confirmations={[
              { className: "bg-danger", svg: SVGS.trash, text: "" },
            ]}
          />
        </>
      }
    >
      <ListView tasks={tasks} deleteTask={deleteTask} />
    </Section>
  );
};

export const reminderToMinutes = (amount: number, unit: string) => {
  return amount * (unit === "minutes" ? 1 : unit === "hours" ? 60 : 3600);
};

const calculateMinutesAgo = (startDatetime: string): number => {
  const startDate = new Date(startDatetime);
  const now = new Date();

  const diffMinutes = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60)
  );

  return diffMinutes;
};

const calculateMinutesRemaining = (dueDatetime: string): number => {
  const dueDate = new Date(dueDatetime);
  const now = new Date();

  const diffMinutes = Math.floor(
    (dueDate.getTime() - now.getTime()) / (1000 * 60)
  );

  return diffMinutes;
};

const calculatePercentageDone = (
  totalMinutes: number,
  workedMinutes: number
) => {
  // Keep only the first 3 digits after the decimal point
  return Math.round((workedMinutes / totalMinutes) * 100);
};

const TaskStadistics = ({ task }: { task: TTask }) => {
  const { t } = useTranslation();
  return (
    <div className="flex-row align-center justify-between">
      <div>
        <div>
          {t("startsOn")}{" "}
          {task.startDatetime
            ? new Date(task.startDatetime).toLocaleString()
            : ""}
        </div>
        <div>
          {t("endsOn")}{" "}
          {task.dueDatetime ? new Date(task.dueDatetime).toLocaleString() : ""}
        </div>
      </div>
      <CircularProgress
        percentage={calculatePercentageDone(
          transformToMinutes(
            task.estimatedTime ? task.estimatedTime : 0,
            task.estimatedTimeUnit ? task.estimatedTimeUnit : "minutes"
          ),
          calculateMinutesAgo(task.startDatetime || "")
        )}
      />
    </div>
  );
};

const TaskCard = ({
  task,
  deleteTask,
}: {
  task: TTask;
  deleteTask: () => void;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const resetTask = async () => {
    await upsertTask(task, true);
    await notify(t("taskResetSuccess"), task.title);
  };

  return (
    <div className={`task-card ${task.priority}`}>
      <h3>
        {task.title} {task.createdAt}
      </h3>
      <p>{task.description}</p>

      <TaskStadistics task={task} />

      <p className="flex-row gap-5">
        <strong>{t("reminderEvery")}</strong>
        <span>{task.reminderEvery}</span>
        <span>{t("minutes")}</span>
      </p>
      <p>
        <strong>{"☁️"}</strong> {task.motivationText}
      </p>
      <p>
        <strong>{t("priority")}</strong> {t(task.priority)}
      </p>
      <div className="flex-row gap-5">
        <Button
          className="w-100 justify-center padding-5 "
          text={t("delete")}
          onClick={deleteTask}
          confirmations={[{ text: t("sure?"), className: "bg-danger" }]}
        />
        <Button
          className="w-100 justify-center padding-5 "
          text={t("reset")}
          onClick={resetTask}
          // confirmations={[{ text: t("sure?"), className: "bg-danger" }]}
        />
        <Button
          className="w-100 justify-center padding-5 active-on-hover  "
          text={t("edit")}
          onClick={() => {
            cacheLocation(`/tasks/${task.id}`, "/tasks");
            navigate(`/tasks/${task.id}`);
          }}
        />
      </div>
    </div>
  );
};

const ListView = ({
  tasks,
  deleteTask,
}: {
  tasks: TTask[];
  deleteTask: (index: number) => void;
}) => {
  return (
    <div className="flex-column gap-10">
      {tasks.map((task, index) => (
        <TaskCard task={task} deleteTask={() => deleteTask(index)} />
      ))}
    </div>
  );
};
