import { Section } from "../../../components/Section/Section";
import { useNavigate, useParams } from "react-router";
import { cacheLocation } from "../../../utils/lib";
import toast from "react-hot-toast";
import { TSnaptie } from "../../../types";
import { useEffect, useState } from "react";
import { ChromeStorageManager } from "../../../managers/Storage";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/Button/Button";
import { SVGS } from "../../../assets/svgs";
import { Textarea } from "../../../components/Textarea/Textarea";
import { LabeledInput } from "../../../components/LabeledInput/LabeledInput";

export default function SnaptieDetail() {
  const [snaptie, setSnaptie] = useState<TSnaptie | null>(null);
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

  return (
    <Section
      close={() => {
        navigate("/snapties");
        cacheLocation("/snapties");
      }}
      title={t("edit")}
    >
      <form onSubmit={saveSnaptie} className="flex-column gap-10">
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
        <Textarea
          label={t("content")}
          name="content"
          defaultValue={snaptie?.content || ""}
          onChange={(e) => {
            if (!snaptie) return;
            setSnaptie({ ...snaptie, content: e });
          }}
        />

        <LabeledInput
          name="category"
          label={t("category")}
          type="text"
          value={snaptie?.category || ""}
          onChange={(e) => {
            if (!snaptie) return;
            setSnaptie({ ...snaptie, category: e });
          }}
        />
        <Button
          type="submit"
          text={t("save")}
          className="w-100 padding-5 justify-center"
          svg={SVGS.save}
        />
      </form>
    </Section>
  );
}
