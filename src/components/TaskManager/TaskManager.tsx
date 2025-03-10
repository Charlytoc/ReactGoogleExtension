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

const dateToMilliseconds = (dateString: string) => {
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? 0 : date.getTime();
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

  const nowInMilliseconds = new Date().getTime();
  const taskMilliseconds = task.startDatetime
    ? dateToMilliseconds(task.startDatetime)
    : nowInMilliseconds;

  console.log("Current Time (ms):", nowInMilliseconds);
  console.log("Task Start Time:", task.startDatetime);
  console.log("Task Start Time (ms):", taskMilliseconds);
  console.log("Time Difference (ms):", taskMilliseconds - nowInMilliseconds);
  console.log(
    "Time Difference (minutes):",
    (taskMilliseconds - nowInMilliseconds) / 60000
  );

  if (alarm) {
    createAlarm(
      task.id,
      task.startDatetime
        ? dateToMilliseconds(task.startDatetime)
        : nowInMilliseconds,
      task.reminderEvery ? task.reminderEvery : 1000
    );

    createAlarm(
      task.id + "-endOfTask",
      task.dueDatetime
        ? dateToMilliseconds(task.dueDatetime)
        : nowInMilliseconds,
      1000
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
        <div className="">
          <div className="flex-row gap-5">
            <span>{t("reminderEvery")}</span>
            <span>{task.reminderEvery}</span>
            <span>{t("minutes")}</span>
          </div>
          <blockquote className="blockquote">
            <strong>{"☁️"}</strong> {task.motivationText}
          </blockquote>
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

  return (
    <div className={`task-card ${task.priority}`}>
      <h3 className="text-center">{task.title}</h3>
      <p className="text-mini">{task.description}</p>

      <TaskStadistics task={task} />

      <div className="flex-row gap-5">
        <Button
          className="w-100 justify-center padding-5 "
          text={t("delete")}
          onClick={deleteTask}
          confirmations={[{ text: t("sure?"), className: "bg-danger" }]}
        />
        <Button
          className="w-100 justify-center padding-5 active-on-hover  "
          text={t("edit")}
          onClick={() => {
            cacheLocation(`/tasks/${task.id}`, "/tasks");
            navigate(`/tasks/${task.id}`);
          }}
        />
        <Button
          className="w-100 justify-center padding-5 active-on-hover  "
          text={t("markAsDone")}
          onClick={() => {
            task.status = "DONE";
            upsertTask(task, false);
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
