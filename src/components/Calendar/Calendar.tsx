import { useEffect, useState } from "react";
import { TTask } from "../../types";
import { TNote } from "../../types";
import { ChromeStorageManager } from "../../managers/Storage";
import { useTranslation } from "react-i18next";
import { cacheLocation } from "../../utils/lib";
import { useNavigate } from "react-router";
import { Section } from "../Section/Section";
import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";

const daysKeys = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

type TTasksByDate = Record<number, TTask[]>;
type TNotesByDate = Record<number, TNote[]>;

const Calendar = () => {
  const today = new Date();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasksByDate, setTasksByDate] = useState<TTasksByDate>({});
  const [notesByDate, setNotesByDate] = useState<TNotesByDate>({});

  useEffect(() => {
    getTasksByDate().then(setTasksByDate);
    getNotesByDate().then(setNotesByDate);
  }, [month, year]); // Se ejecuta cuando cambian el mes o el año

  const getTasksByDate = async () => {
    const tasks = await ChromeStorageManager.get("tasks");
    const tasksByDate: TTasksByDate = {};
    tasks.forEach((task: TTask) => {
      const taskDate = new Date(task.createdAt || "");
      if (taskDate.getFullYear() === year && taskDate.getMonth() === month) {
        const day = taskDate.getDate();
        tasksByDate[day] = [...(tasksByDate[day] || []), task];
      }
    });
    return tasksByDate;
  };

  const getNotesByDate = async () => {
    const notes = await ChromeStorageManager.get("notes");
    const notesByDate: TNotesByDate = {};
    notes.forEach((note: TNote) => {
      const noteDate = new Date(note.createdAt || "");
      if (noteDate.getFullYear() === year && noteDate.getMonth() === month) {
        const day = noteDate.getDate();
        notesByDate[day] = [...(notesByDate[day] || []), note];
      }
    });
    return notesByDate;
  };

  const prevMonth = () => {
    setMonth((prev) => (prev === 0 ? 11 : prev - 1));
    if (month === 0) setYear((prev) => prev - 1);
  };

  const nextMonth = () => {
    setMonth((prev) => (prev === 11 ? 0 : prev + 1));
    if (month === 11) setYear((prev) => prev + 1);
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (new Date(year, month, 1).getDay() + 7) % 7;

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
        isToday={date.toDateString() === today.toDateString()}
      />
    );
  }

  return (
    <Section
      className="bg-gradient"
      headerLeft={<h3 className="font-mono">{t("calendar")}</h3>}
      close={() => {
        navigate("/index.html");
        cacheLocation("/index.html", "/calendar");
      }}
    >
      <div className="gap-5 padding-5">
        <div className="flex-row gap-5 justify-between">
          <Button onClick={prevMonth} svg={SVGS.previous} />
          <h3>
            {t("month") + " " + (month + 1)} - {t("year") + " " + year}
          </h3>
          <Button onClick={nextMonth} svg={SVGS.next} />
        </div>
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
    </Section>
  );
};

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
      className={`rounded padding-5 day-cell ${
        isToday ? "border-active" : "border-gray"
      }`}
    >
      <h3 className="text-center font-bold">{date.getDate()}</h3>
      <div className="flex flex-row gap-5 wrap">
        {tasks.map((task) => (
          <div
            key={task.id}
            title={t("task") + ": " + task.title}
            className="task-small bg-warning pointer"
            onClick={() => openTask(task)}
          ></div>
        ))}
        {notes.length > 0 &&
          notes.map((note) => (
            <div
              key={note.id}
              title={t("note") + ": " + note.title}
              style={{ backgroundColor: note.color }}
              className="ball-small pointer"
              onClick={() => openNote(note)}
            >
              <p className="hidden">{note.title}</p>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Calendar;
