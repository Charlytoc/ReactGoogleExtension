import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";

import { TFormatter } from "../../types";
import { ChromeStorageManager } from "../../managers/Storage";
import { cacheLocation, generateRandomId } from "../../utils/lib";
import { Button } from "../Button/Button";
import { Section } from "../Section/Section";
import { LabeledInput } from "../LabeledInput/LabeledInput";
import { SVGS } from "../../assets/svgs";

export const Formatters = () => {
  const [formatters, setFormatters] = useState<TFormatter[]>([]);
  const [nameFilter, setNameFilter] = useState("");

  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    getFormatters();
  }, []);

  const getFormatters = async () => {
    const stored = await ChromeStorageManager.get("formatters");
    if (stored && Array.isArray(stored)) {
      setFormatters(stored);
    }
  };

  const addFormatter = async () => {
    const bodyElement = document.body;
    const styles = getComputedStyle(bodyElement);
    const cssVariableValue = styles.getPropertyValue("--bg-color");

    const defaultFormatter: TFormatter = {
      id: generateRandomId("formatter"),
      title: "",
      description: "",
      inputs: [
        { id: "input-a", label: "A" },
        { id: "input-b", label: "B" },
      ],
      prompt:
        "Take the inputs and return the formatted string. Always answer with a single string and no explanations.",
      createdAt: new Date().toISOString(),
      category: "",
      color: cssVariableValue,
    };

    const previous = await ChromeStorageManager.get("formatters");
    if (previous && Array.isArray(previous)) {
      await ChromeStorageManager.add("formatters", [...previous, defaultFormatter]);
    } else {
      await ChromeStorageManager.add("formatters", [defaultFormatter]);
    }

    cacheLocation(`/formatters/${defaultFormatter.id}`, "/formatters");
    navigate(`/formatters/${defaultFormatter.id}`);
  };

  const deleteFormatter = async (id: string) => {
    const newFormatters = formatters.filter((f) => f.id !== id);
    await ChromeStorageManager.add("formatters", newFormatters);
    setFormatters(newFormatters);
    toast.success(t("delete"));
  };

  const filteredFormatters = nameFilter
    ? formatters.filter((f) =>
        f.title.toLowerCase().includes(nameFilter.toLowerCase()) ||
        (f.category || "").toLowerCase().includes(nameFilter.toLowerCase())
      )
    : formatters;

  return (
    <Section
      className="bg-gradient"
      close={() => {
        cacheLocation("/index.html");
        navigate("/index.html");
      }}
      headerLeft={<h3 className="font-mono">{t("formatters")}</h3>}
      headerRight={
        <Button
          className="padding-5"
          onClick={addFormatter}
          svg={SVGS.plus}
          title={t("add")}
        />
      }
    >
      <div className="flex-column gap-10 padding-10">
        <div className="flex-row gap-10">
          <LabeledInput
            className="w-100"
            label={t("filter-by-name")}
            name="name-filter-formatters"
            type="text"
            placeholder={t("search")}
            value={nameFilter}
            onChange={(value) => setNameFilter(value)}
          />
        </div>

        {filteredFormatters.length === 0 ? (
          <div className="text-center text-gray-600 padding-20">
            {formatters.length === 0 ? t("no-categories-available") : t("no-snapdeals-found")}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-10">
            {filteredFormatters.map((formatter) => (
              <FormatterCard
                key={formatter.id}
                formatter={formatter}
                onDelete={deleteFormatter}
                onOpen={() => {
                  cacheLocation(`/formatters/${formatter.id}`, "/formatters");
                  navigate(`/formatters/${formatter.id}`);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
};

const FormatterCard = ({
  formatter,
  onDelete,
  onOpen,
}: {
  formatter: TFormatter;
  onDelete: (id: string) => void;
  onOpen: () => void;
}) => {
  const inputLabels = formatter.inputs.map((input) => input.label).join(", ");

  return (
    <div
      className="padding-10 border-gray rounded flex-column gap-5 pointer scale-on-hover pos-relative"
      style={{ backgroundColor: formatter.color || "var(--bg-color-secondary)" }}
      onClick={onOpen}
    >
      <h4 className="font-mono text-center">{formatter.title || "Formatter"}</h4>
      {formatter.description && (
        <p className="text-sm text-gray-200 line-clamp-2">{formatter.description}</p>
      )}
      <div className="text-xs text-gray-300 font-mono">
        {inputLabels && <div>Inputs: {inputLabels}</div>}
        {formatter.prompt && (
          <div className="line-clamp-2">{formatter.prompt}</div>
        )}
      </div>
      <div className="flex-row gap-5 justify-end">
        <Button
          className="padding-5"
          svg={SVGS.trash}
          onClick={() => {
            onDelete(formatter.id);
          }}
        />
      </div>
    </div>
  );
};
