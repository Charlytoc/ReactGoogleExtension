import { TTask } from "../../types";
import { useTranslation } from "react-i18next";
import { LabeledInput } from "../LabeledInput/LabeledInput";
import { Button } from "../Button/Button";
import { Select } from "../Select/Select";
import { useRef } from "react";

const makeHumanReadableDatetime = (date: string) => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const TaskForm = ({
  closeForm,
  handleSubmit,
  initialValues = {
    id: "",
    title: "",
    description: "",
    startDatetime: "",
    dueDatetime: "",
    reminderEvery: undefined,
    motivationText: "",
    priority: "low",
    estimatedTime: undefined,
    estimatedTimeUnit: "minutes",
    status: "TODO",
    createdAt: "",
  },
  title,
}: {
  closeForm: () => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  initialValues?: TTask;
  title?: string;
}) => {
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement>(null);

  const getFormContext = () => {
    if (!formRef.current) return "No form found";
    const formData = new FormData(formRef.current);
    const formDataObject = Object.fromEntries(formData);
    return JSON.stringify(formDataObject);
  };

  return (
    <form
      ref={formRef}
      className="flex-column gap-10"
      onSubmit={(e) => {
        handleSubmit(e);
        closeForm();
      }}
    >
      <h3>{title || t("addTask")}</h3>
      <LabeledInput
        label={t("title")}
        required
        type="text"
        name="title"
        placeholder={t("title-placeholder")}
        defaultValue={initialValues.title}
      />
      <LabeledInput
        label={t("description")}
        type="text"
        name="description"
        placeholder={t("description-placeholder")}
        defaultValue={initialValues.description}
      />
      <LabeledInput
        label={t("startDatetime")}
        type="datetime-local"
        required
        name="startDatetime"
        // placeholder={t("startDatetime")}
        defaultValue={initialValues.startDatetime}
      />
      <div className="flex-row gap-5 align-center">
        <LabeledInput
          label={t("estimatedTime")}
          type="number"
          name="estimatedTime"
          // placeholder={t("estimatedTime")}
          defaultValue={initialValues.estimatedTime}
        />
        <span>{t("in")}</span>
        <Select
          name="estimatedTimeUnit"
          options={[
            { label: t("minutes"), value: "minutes" },
            { label: t("hours"), value: "hours" },
            { label: t("days"), value: "days" },
          ]}
          defaultValue={initialValues.estimatedTimeUnit || ""}
        />
      </div>
      {initialValues.dueDatetime && (
        <p className="text-mini color-gray">
          {t("task-ready-at")}:{" "}
          {makeHumanReadableDatetime(initialValues.dueDatetime)}
        </p>
      )}

      <div className="border-gray rounded-10 padding-10">
        <section className="flex-row gap-5 align-center">
          <span>{t("rememberMe")}</span>
          <input
            type="checkbox"
            defaultChecked={Boolean(initialValues.reminderEvery)}
            name="rememberMe"
          />

          <span>{t("every")}</span>
          <input
            className="w-50  bg-transparent rounded"
            type="number"
            name="every"
            defaultValue={initialValues.reminderEvery}
            min={1}
          />

          <Select
            name="unit"
            options={[
              { label: t("minutes"), value: "minutes" },
              { label: t("hours"), value: "hours" },
              { label: t("days"), value: "days" },
            ]}
            defaultValue="minutes"
          />
        </section>
        <section>
          <p className="text-mini color-gray">{t("rememberMeInfo")}</p>
        </section>
      </div>

      <div>
        <LabeledInput
          label={t("motivationText")}
          type="text"
          name="motivationText"
          placeholder={t("motivationTextPlaceholder")}
          defaultValue={initialValues.motivationText}
          aiButton={true}
          getAIContext={getFormContext}
          fillPrompt={(currentValue, inputData) => {
            return `
            This is the current value of the input: ${currentValue}
            This is the data of the form: ${inputData}

            Please make sure to generate something related to the rest of the task. It should be a motivational text of up to 10 words that would motivate the user to complete the task. Try to add an emoji to the text.
            `;
          }}
        />
      </div>

      <Select
        className="w-100 rounded"
        name="priority"
        options={[
          { label: t("low"), value: "low" },
          { label: t("medium"), value: "medium" },
          { label: t("high"), value: "high" },
        ]}
        defaultValue={initialValues.priority}
      />

      <Button
        type="submit"
        text={t("finish")}
        className="w-100 justify-center padding-5 active-on-hover"
      />
    </form>
  );
};
