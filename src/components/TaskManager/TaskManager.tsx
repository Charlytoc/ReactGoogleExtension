import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import "./TaskManager.css";
import { useNavigate } from "react-router";
import {
  cacheLocation,
  generateRandomId,
  // transformToMinutes,
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

import { TaskCard } from "./TaskCard";
// import CircularProgress from "../CircularProgress/CircularProgress";
// import { LabeledInput } from "../LabeledInput/LabeledInput";

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

  if (alarm && task.startDatetime && task.dueDatetime) {
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
  const [view, setView] = useState<"list" | "table">("list");
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
      className="bg-gradient"
      headerLeft={<h3 className="font-mono">{t("taskManager")}</h3>}
      close={() => {
        cacheLocation("/index.html", "lastPage");
        navigate("/index.html");
      }}
      headerRight={
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
          <Button
            onClick={() => setView(view === "list" ? "table" : "list")}
            className="justify-center padding-5 "
            title={t("toggleView")}
            svg={view === "list" ? SVGS.table : SVGS.list}
          />
        </>
      }
    >
      {view === "list" ? (
        <ListView tasks={tasks} deleteTask={deleteTask} reload={getTasks} />
      ) : (
        <TableView tasks={tasks} />
      )}
    </Section>
  );
};

export const reminderToMinutes = (amount: number, unit: string) => {
  return amount * (unit === "minutes" ? 1 : unit === "hours" ? 60 : 3600);
};

const ListView = ({
  tasks,
  deleteTask,
  reload,
}: {
  tasks: TTask[];
  deleteTask: (index: number) => void;
  reload: () => void;
}) => {
  return (
    <div className="flex-column gap-10">
      {tasks.map((task, index) => (
        <TaskCard
          key={task.id}
          task={task}
          deleteTask={() => deleteTask(index)}
          reload={reload}
        />
      ))}
    </div>
  );
};

const columns = [
  { key: "title", label: "📌 Title" },
  { key: "startDatetime", label: "📅 Start" },
  { key: "dueDatetime", label: "⏳ Due" },
  { key: "estimatedTime", label: "⏱️ Est." },
  { key: "progress", label: "🎯 Progress" },
  { key: "motivationText", label: "📖 Motivation" },
  { key: "actions", label: "⚙️ Actions" },
];

export const TableView = ({ tasks }: { tasks: TTask[] }) => {
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    () => Object.fromEntries(columns.map((col) => [col.key, true]))
  );
  // const { t } = useTranslation();

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="table-view">
      <table>
        <thead>
          <tr>
            {columns.map(
              (col) =>
                visibleColumns[col.key] && (
                  <th key={col.key} onClick={() => toggleColumn(col.key)}>
                    {col.label}
                  </th>
                )
            )}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              {visibleColumns.title && <td>{task.title}</td>}

              {visibleColumns.startDatetime && (
                <td>
                  {task.startDatetime
                    ? new Date(task.startDatetime).toLocaleString()
                    : "-"}
                </td>
              )}

              {visibleColumns.dueDatetime && (
                <td>
                  {task.dueDatetime
                    ? new Date(task.dueDatetime).toLocaleString()
                    : "-"}
                </td>
              )}

              {visibleColumns.estimatedTime && (
                <td>
                  {task.estimatedTime} {task.estimatedTimeUnit}
                </td>
              )}

              {visibleColumns.progress && <td>—{/* Add progress here */}</td>}

              {visibleColumns.motivationText && (
                <td>
                  <em>{task.motivationText ?? "—"}</em>
                </td>
              )}

              {visibleColumns.actions && (
                <td className="actions">
                  <Button
                    text="Edit"
                    onClick={() => console.log("Edit", task.id)}
                  />
                  <Button
                    text="Delete"
                    onClick={() => console.log("Delete", task.id)}
                  />
                  <Button
                    text="Done"
                    onClick={() => {
                      task.status = "DONE";
                      console.log("Mark as done", task.id);
                    }}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
