import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import "./TaskManager.css";
import { useNavigate } from "react-router";
import { cacheLocation } from "../../utils/lib";
import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import { TTask, TTaskPriority } from "../../types";
import { LabeledInput } from "../LabeledInput/LabeledInput";
import { ChromeStorageManager } from "../../managers/Storage";
import {
  clearAlarm,
  clearAllAlarms,
  createAlarm,
  notify,
} from "../../utils/chromeFunctions";
import { Section } from "../Section/Section";

const hashText = (text: string) => {
  return text.replace(/\s+/g, "-");
};

const dateToMilliseconds = (date: string) => {
  return new Date(date).getTime();
};

export const TaskManager = () => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<TTask[]>([]);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const getTasks = async () => {
      const tasks = await ChromeStorageManager.get("tasks");
      if (tasks) {
        setTasks(tasks);
      }
    };
    getTasks();
  }, [showForm]);

  const deleteTask = async (index: number) => {
    const newTasks = tasks.filter((_, i) => i !== index);
    await ChromeStorageManager.add("tasks", newTasks);
    setTasks(newTasks);

    clearAlarm(tasks[index].id);
    notify(t("alarmCancelled"), tasks[index].title);
  };

  return (
    <Section
      title={t("taskManager")}
      close={() => {
        cacheLocation("/index.html");
        navigate("/index.html");
      }}
      extraButtons={
        <>
          <Button
            onClick={() => setShowForm(!showForm)}
            className="justify-center padding-5 "
            svg={showForm ? SVGS.close : SVGS.plus}
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
      {showForm ? (
        <TaskForm closeForm={() => setShowForm(false)} />
      ) : (
        <>
          <div className="flex-column gap-10">
            {tasks.map((task, index) => (
              <TaskCard task={task} deleteTask={() => deleteTask(index)} />
            ))}
          </div>
        </>
      )}
    </Section>
    // </div>
  );
};

const reminderToMinutes = (amount: number, unit: string) => {
  return amount * (unit === "minutes" ? 1 : unit === "hours" ? 60 : 3600);
};

const TaskForm = ({ closeForm }: { closeForm: () => void }) => {
  const { t } = useTranslation();

  const addTask = async (task: TTask) => {
    const tasks = await ChromeStorageManager.get("tasks");
    if (tasks) {
      await ChromeStorageManager.add("tasks", [...tasks, task]);
    } else {
      await ChromeStorageManager.add("tasks", [task]);
    }

    createAlarm(
      task.id,
      dateToMilliseconds(task.startDatetime),
      task.reminderEvery ? task.reminderEvery : 1000
    );
    notify(t("alarmSet").replace("%s", task.title), task.reminderText || "");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const startDatetime = formData.get("startDatetime") as string;
    const dueDatetime = formData.get("dueDatetime") as string;
    const reminderText = formData.get("reminderText") as string;
    const priority = formData.get("priority") as TTaskPriority;
    const rememberMe = formData.get("rememberMe") as string;
    const every = formData.get("every") as string;
    const unit = formData.get("unit") as string;
    const reminderEvery = reminderToMinutes(Number(every), unit);

    const task: TTask = {
      id: hashText(title),
      title,
      description,
      startDatetime,
      dueDatetime,
      reminderEvery: rememberMe === "on" ? reminderEvery : undefined,
      reminderText,
      priority,
    };
    await addTask(task);
    closeForm();
  };
  return (
    <form className="flex-column gap-10" onSubmit={handleSubmit}>
      <h3>{t("addTask")}</h3>
      <LabeledInput
        label={t("title")}
        required
        type="text"
        name="title"
        // placeholder={t("title")}
      />
      <LabeledInput
        label={t("description")}
        type="text"
        name="description"
        // placeholder={t("description")}
      />
      <LabeledInput
        label={t("startDatetime")}
        type="datetime-local"
        required
        name="startDatetime"
        // placeholder={t("startDatetime")}
      />
      <LabeledInput
        label={t("estimatedTime")}
        type="number"
        name="estimatedTime"
        // placeholder={t("estimatedTime")}
      />
      <LabeledInput
        required
        label={t("dueDatetime")}
        type="datetime-local"
        name="dueDatetime"
        // placeholder={t("dueDatetime")}
      />

      <div className="flex-row gap-5 align-center">
        <span>{t("rememberMe")}</span>
        <input type="checkbox" name="rememberMe" />

        <span>{t("every")}</span>
        <input
          className="w-50  bg-transparent rounded"
          type="number"
          name="every"
          min={1}
        />

        <select name="unit" id="unit" className="padding-5 bg-default rounded">
          <option value="minutes">{t("minutes")}</option>
          <option value="hours">{t("hours")}</option>
          <option value="days">{t("days")}</option>
        </select>
      </div>
      <LabeledInput
        label={t("reminderText")}
        type="text"
        name="reminderText"
        // placeholder={t("reminderText")}
      />
      <select className="w-100 bg-default padding-5 rounded" name="priority">
        <option value="low">{t("low")}</option>
        <option value="medium">{t("medium")}</option>
        <option value="high">{t("high")}</option>
      </select>
      <Button
        text={t("finish")}
        className="w-100 justify-center padding-5 active-on-hover"
      />
    </form>
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

  // const setAlarm = (task: TTask) => {
  //   notify(t("alarmSet").replace("%s", task.title), task.reminderText || "");
  //   clearAlarm(task.id);
  //   clearAlarm(task.id + "-endOfTask");

  //   createAlarm(
  //     task.id,
  //     dateToMilliseconds(task.startDatetime),
  //     task.reminderEvery ? task.reminderEvery : 5
  //   );

  //   createAlarm(
  //     task.id + "-endOfTask",
  //     dateToMilliseconds(task.dueDatetime),
  //     task.reminderEvery ? task.reminderEvery : 5
  //   );
  // };

  return (
    <div className={`task-card ${task.priority}`}>
      <h3>{task.title}</h3>
      <p>{task.description}</p>

      <p>
        {/* Show this in a better format */}
        <strong>{t("startsOn")}</strong>{" "}
        {new Date(task.startDatetime).toLocaleString()}
      </p>
      <p>
        <strong>{t("endsOn")}</strong>{" "}
        {new Date(task.dueDatetime).toLocaleString()}
      </p>
      <p className="flex-row gap-5">
        <strong>{t("reminderEvery")}</strong>
        <span>{task.reminderEvery}</span>
        <span>{t("minutes")}</span>
      </p>
      <p>
        <strong>{t("reminderText")}</strong> {task.reminderText}
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
          className="w-100 justify-center padding-5 active-on-hover  "
          text={t("edit")}
          // onClick={editTask}
        />
      </div>
    </div>
  );
};
