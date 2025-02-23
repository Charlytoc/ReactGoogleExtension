import { useEffect, useState } from "react";
import { TTask } from "../../types";
import { TNote } from "../../types";
import { ChromeStorageManager } from "../../managers/Storage";
import { useTranslation } from "react-i18next";
import { cacheLocation } from "../../utils/lib";
import { useNavigate } from "react-router";
import { Section } from "../Section/Section";

// Componente para representar un solo día del calendario
const Day = ({
  date,
  tasks,
  notes,
  isToday,
}: {
  date: Date;
  tasks: TTask[];
  notes: TNote[];
  isToday: boolean;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const openNote = (note: TNote) => {
    cacheLocation(`/notes/${note.id}`, "/calendar");
    navigate(`/notes/${note.id}`);
  };

  const openTask = (task: TTask) => {
    cacheLocation(`/tasks/${task.id}`, "/calendar");
    navigate(`/tasks/${task.id}`);
  };

  return (
    <div
      className={`border-gray rounded padding-5 day-cell ${
        isToday ? "bg-active" : "bg-white"
      }`}
    >
      <h3 className="text-center font-bold">{date.getDate()}</h3>
      <div className="flex flex-row gap-5 wrap">
        {tasks.map((task) => (
          <div
            key={task.id}
            title={t("task") + ": " + task.title}
            className="ball-small bg-warning pointer"
            onClick={() => openTask(task)}
          ></div>
        ))}
        {notes.length > 0 &&
          notes.map((note) => (
            <div
              key={note.id}
              title={t("note") + ": " + note.title}
              className="ball-small bg-success pointer"
              onClick={() => openNote(note)}
            >
              <p className="hidden">{note.title}</p>
            </div>
          ))}
      </div>
    </div>
  );
};

const daysKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

type TTasksByDate = Record<number, TTask[]>;
type TNotesByDate = Record<number, TNote[]>;

const Calendar = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // Obtiene el día de la semana del primer día del mes

  const { t } = useTranslation();
  const navigate = useNavigate();

  const [tasksByDate, setTasksByDate] = useState<TTasksByDate>({});
  const [notesByDate, setNotesByDate] = useState<TNotesByDate>({});

  useEffect(() => {
    getTasksByDate().then(setTasksByDate);
    getNotesByDate().then(setNotesByDate);
  }, []);

  const getTasksByDate = async () => {
    const tasks = await ChromeStorageManager.get("tasks");
    const tasksByDate: TTasksByDate = {};
    tasks.forEach((task: TTask) => {
      const taskDate = new Date(task.createdAt || "");
      const day = taskDate.getDate();
      tasksByDate[day] = [...(tasksByDate[day] || []), task];
    });
    console.log(tasksByDate, "tasksByDate");

    return tasksByDate;
  };

  const getNotesByDate = async () => {
    const notes = await ChromeStorageManager.get("notes");
    const notesByDate: TNotesByDate = {};
    notes.forEach((note: TNote) => {
      const noteDate = new Date(note.createdAt || "");
      const day = noteDate.getDate();
      notesByDate[day] = [...(notesByDate[day] || []), note];
    });
    return notesByDate;
  };

  // Generar los días vacíos antes del primer día del mes
  const placeholders = Array.from({ length: firstDayOfMonth }, (_, i) => (
    <div key={`empty-${i}`} className="empty-cell"></div>
  ));

  const days = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    days.push(
      <Day
        key={i}
        date={date}
        tasks={tasksByDate[i] || []}
        notes={notesByDate[i] || []}
        isToday={i === todayDate}
      />
    );
  }

  return (
    <Section
      title={t("calendar")}
      close={() => {
        navigate("/index.html");
        cacheLocation("/index.html", "/calendar");
      }}
    >
      <div>
        <div className="gap-5 padding-5">
          <div className="grid grid-cols-7 gap-5 font-bold">
            {daysKeys.map((day, index) => (
              <div className="text-center w-100" key={index}>
                {t(day).charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-5">
            {placeholders}
            {days}
          </div>
        </div>
      </div>
    </Section>
  );
};

export default Calendar;
