import { useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import { ChromeStorageManager } from "../../../managers/Storage";
import { TTask, TTaskPriority, TTaskStatus } from "../../../types";
import { Section } from "../../../components/Section/Section";
import { cacheLocation, transformToMinutes } from "../../../utils/lib";
import {
  upsertTask,
  reminderToMinutes,
} from "../../../components/TaskManager/TaskManager";

import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { notify } from "../../../utils/chromeFunctions";
import { TaskForm } from "../../../components/TaskManager/TaskForm";

export default function TaskDetail() {
  const navigate = useNavigate();
  const [task, setTask] = useState<TTask | null>(null);
  const { id } = useParams();

  useEffect(() => {
    const getTasks = async () => {
      const tasks = await ChromeStorageManager.get("tasks");
      if (tasks) {
        const task = tasks.find((task: TTask) => task.id === id);
        setTask(task);
      }
    };
    getTasks();
  }, [id]);

  const onFinish = async () => {
    const prevPage = await ChromeStorageManager.get("prevPage");
    cacheLocation(prevPage, "/tasks");
    navigate(prevPage);
  };

  return (
    <Section title={task?.title || ""} close={onFinish}>
      {task && <TaskVisualizer task={task} onFinish={onFinish} />}
    </Section>
  );
}



const estimateDueTime = (
  estimatedTime: number,
  estimatedTimeUnit: string,
  startDatetime: string
) => {
  const now = new Date(startDatetime);
  const dueDate = new Date(now);
  dueDate.setMinutes(
    dueDate.getMinutes() + transformToMinutes(estimatedTime, estimatedTimeUnit)
  );
  return dueDate.toISOString();
};

const TaskVisualizer = ({
  task,
  onFinish,
}: {
  task: TTask;
  onFinish: () => void;
}) => {
  const { t } = useTranslation();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    const toastId = toast.loading(t("savingTask"));
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const startDatetime = formData.get("startDatetime") as string;
    const estimatedTime = formData.get("estimatedTime") as string;
    const estimatedTimeUnit = formData.get("estimatedTimeUnit") as string;
    const dueDatetime = estimateDueTime(
      Number(estimatedTime),
      estimatedTimeUnit,
      startDatetime
    );
    const motivationText = formData.get("motivationText") as string;
    const priority = formData.get("priority") as TTaskPriority;
    const status = formData.get("status") as TTaskStatus;
    const rememberMe = formData.get("rememberMe") as string;
    const every = formData.get("every") as string;
    const unit = formData.get("unit") as string;
    const reminderEvery = reminderToMinutes(Number(every), unit);
    const createdAt = new Date().toISOString();

    const editedTask: TTask = {
      id: task.id,
      title,
      description,
      startDatetime,
      dueDatetime,
      reminderEvery: rememberMe === "on" ? reminderEvery : undefined,
      motivationText,
      priority,
      estimatedTime: Number(estimatedTime),
      estimatedTimeUnit,
      status,
      createdAt,
    };

    await upsertTask(editedTask);
    notify(
      t("alarmSet").replace("%s", editedTask.title),
      editedTask.motivationText || ""
    );
    toast.success(t("taskSaved"), { id: toastId });
    onFinish();
  };
  return (
    <TaskForm
      closeForm={() => {}}
      handleSubmit={handleSubmit}
      initialValues={task}
      title={t("editTask")}
    />
  );
};
