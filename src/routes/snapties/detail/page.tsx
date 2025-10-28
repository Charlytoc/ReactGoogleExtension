import { Section } from "../../../components/Section/Section";
import { useNavigate, useParams } from "react-router";
import { cacheLocation } from "../../../utils/lib";
import toast from "react-hot-toast";
import { TSnaptie } from "../../../types";
import { useEffect, useRef, useState } from "react";
import { ChromeStorageManager } from "../../../managers/Storage";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/Button/Button";
import { SVGS } from "../../../assets/svgs";
import { Textarea } from "../../../components/Textarea/Textarea";
import { LabeledInput } from "../../../components/LabeledInput/LabeledInput";
import { Select } from "../../../components/Select/Select";
import { RenderMarkdown } from "../../../components/RenderMarkdown/RenderMarkdown";

export default function SnaptieDetail() {
  const formRef = useRef<HTMLFormElement>(null);
  const [snaptie, setSnaptie] = useState<TSnaptie | null>(null);
  const [usedColors, setUsedColors] = useState<string[]>([]);
  const [usedCategories, setUsedCategories] = useState<string[]>([]);
  const [isMarkdownMode, setIsMarkdownMode] = useState(false);

  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id } = useParams();

  useEffect(() => {
    getSnaptie();
  }, [id]);

  const getSnaptie = async () => {
    const snapties = await ChromeStorageManager.get("snapties");
    const snaptie = snapties.find((snaptie: TSnaptie) => snaptie.id === id);
    setSnaptie(snaptie);

    setUsedColors([
      ...new Set(
        snapties
          .filter((snaptie: TSnaptie) => snaptie.color !== undefined)
          .map((snaptie: TSnaptie) => snaptie.color)
      ),
    ] as string[]);

    setUsedCategories([
      ...new Set(
        snapties
          .filter((snaptie: TSnaptie) => snaptie.category && snaptie.category.trim() !== "")
          .map((snaptie: TSnaptie) => snaptie.category)
      ),
    ] as string[]);
  };

  const saveSnaptie = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!snaptie) return;
    const prevSnapties = await ChromeStorageManager.get("snapties");
    const newSnapties = prevSnapties.map((snap: TSnaptie) =>
      snap.id === id ? { ...snap, ...snaptie } : snap
    );
    await ChromeStorageManager.add("snapties", newSnapties);
    toast.success(t("snaptie-saved"));
    navigate("/snapties");
    cacheLocation("/snapties");
  };

  console.log(snaptie, "snaptie");

  return (
    <Section
      className="bg-gradient"
      close={() => {
        navigate("/snapties");
        cacheLocation("/snapties");
      }}
      headerLeft={<h3 className="font-mono">{t("edit")}</h3>}
      headerRight={
        <div className="flex-row gap-10 align-center">
          <Button
            onClick={() => setIsMarkdownMode(!isMarkdownMode)}
            text={isMarkdownMode ? t("edit") : t("preview")}
            className="w-auto padding-5 justify-center"
            svg={isMarkdownMode ? SVGS.text : SVGS.markdown}
          />
          <Button
            onClick={() => {
              console.log("saveSnaptie");
              formRef.current?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
            }}
            text={t("save")}
            className="w-100 padding-5 justify-center"
            svg={SVGS.save}
          />
        </div>
      }
    >
      <div className="padding-10 rounded-10">
        <form ref={formRef} onSubmit={saveSnaptie} className="flex-column gap-10 snaptie-form">
          <LabeledInput
            name="title"
            label={t("title")}
            type="text"
            value={snaptie?.title || ""}
            onChange={(e) => {
              if (!snaptie) return;
              setSnaptie({ ...snaptie, title: e });
            }}
          />
          
          {isMarkdownMode ? (
            <div className="markdown-preview-container">
              <div className="markdown-preview-header">
                <span className="markdown-preview-label">{t("content")} - {t("preview")}</span>
              </div>
              <div className="markdown-preview-content">
                <RenderMarkdown markdown={snaptie?.content || ""} />
              </div>
            </div>
          ) : (
            <div className="textarea-container">
              <Textarea
                label={t("content")}
                name="content"
                maxHeight="50vh"
                defaultValue={snaptie?.content || ""}
                onChange={(e) => {
                  if (!snaptie) return;
                  setSnaptie({ ...snaptie, content: e });
                  if (e.startsWith("http") || e.startsWith("file")) {
                    setSnaptie({ ...snaptie, isUrl: true });
                  } else {
                    setSnaptie({ ...snaptie, isUrl: false });
                  }
                }}
              />
            </div>
          )}

          <div className="flex-column gap-5">
            <label className="color-secondary">{t("category")}</label>
            <Select
              name="category"
              options={[
                { label: t("select-category") || "Select category", value: "" },
                ...usedCategories.map(category => ({ label: category, value: category }))
              ]}
              defaultValue={snaptie?.category || ""}
              onChange={(value) => {
                if (!snaptie) return;
                setSnaptie({ ...snaptie, category: value });
              }}
            />
          </div>
          <div className="flex-row gap-10 align-center">
            <span className="color-label">{t("color")}</span>
            <input
              type="color"
              name="color"
              value={snaptie?.color || "#09090d"}
              onChange={(e) => {
                if (!snaptie) return;
                setSnaptie({ ...snaptie, color: e.target.value });
              }}
              className="color-input"
            />
          </div>
          {usedColors.length > 0 && (
            <div className="flex-row gap-10">
              <span className="used-colors-label">{t("used-colors") || "Colores usados"}:</span>
              <div className="used-colors-container">
                {usedColors.map((color) => (
                  <div
                    key={color}
                    className="color-preview pointer"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      if (!snaptie) return;
                      setSnaptie({ ...snaptie, color: color });
                    }}
                    title={`Usar color: ${color}`}
                  ></div>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </Section>
  );
}
