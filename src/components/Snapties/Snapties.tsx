import { useEffect, useState } from "react";
import { TSnaptie } from "../../types";
import { ChromeStorageManager } from "../../managers/Storage";
import { cacheLocation, generateRandomId, isUrl } from "../../utils/lib";
import { Button } from "../Button/Button";
import { SVGS } from "../../assets/svgs";
import { Section } from "../Section/Section";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { LabeledInput } from "../LabeledInput/LabeledInput";
import { Textarea } from "../Textarea/Textarea";

export const Snapties = () => {
  const [snapties, setSnapties] = useState<TSnaptie[]>([]);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getSnapties();
  }, []);

  const getSnapties = async () => {
    const snapties = await ChromeStorageManager.get("snapties");
    if (snapties) {
      setSnapties(snapties);
    }
  };

  const closeAndRefresh = () => {
    setShowForm(false);
    getSnapties();
  };

  const deleteSnaptie = async (id: string) => {
    const newSnapties = snapties.filter((snaptie) => snaptie.id !== id);
    await ChromeStorageManager.add("snapties", newSnapties);
    setSnapties(newSnapties);
  };

  // make a map of categories and the snapties in each category
  const categories = snapties.reduce((acc, snaptie) => {
    if (!acc[snaptie.category]) {
      acc[snaptie.category] = [];
    }
    acc[snaptie.category].push(snaptie);
    return acc;
  }, {} as Record<string, TSnaptie[]>);

  return (
    <Section
      close={() => {
        cacheLocation("/index.html");
        navigate("/index.html");
      }}
      title="Snapties"
      extraButtons={
        <Button
          className="padding-5"
          onClick={() => setShowForm(!showForm)}
          svg={showForm ? SVGS.close : SVGS.plus}
        />
      }
    >
      {showForm ? (
        <SnaptieForm close={closeAndRefresh} />
      ) : (
        <>
          <div className="flex-column gap-10">
            {Object.entries(categories).map(([category, snapties]) => (
              <div key={category}>
                <h2 className="">{category}</h2>
                <div className="flex-row gap-10 wrap">
                  {snapties.map((snaptie) => (
                    <SnaptieCard
                      key={snaptie.id}
                      snaptie={snaptie}
                      deleteSnaptie={deleteSnaptie}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Section>
  );
};

const SnaptieForm = ({ close }: { close: () => void }) => {
  const { t } = useTranslation();
  const [color, setColor] = useState<string>("#09090d");
  const saveSnaptie = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const category = formData.get("category") as string;
    const color = formData.get("color") as string;

    const newSnaptie = {
      id: generateRandomId("snaptie"),
      title,
      content,
      category,
      createdAt: new Date().toISOString(),
      isUrl: isUrl(content),
      color,
    };
    toast.success(t("snaptie-saved"));
    const previousSnapties = await ChromeStorageManager.get("snapties");
    if (previousSnapties) {
      ChromeStorageManager.add("snapties", [...previousSnapties, newSnaptie]);
    } else {
      ChromeStorageManager.add("snapties", [newSnaptie]);
    }
    close();
  };

  return (
    <form
      style={{ backgroundColor: color }}
      onSubmit={saveSnaptie}
      className="flex-column gap-10"
    >
      <LabeledInput
        label={t("title")}
        name="title"
        type="text"
        placeholder={t("my-snaptie")}
      />
      <Textarea
        placeholder={t("something-I-want-to-remember-or-copy-easily")}
        label={t("content")}
        name="content"
      />
      <LabeledInput
        label={t("category")}
        name="category"
        type="text"
        placeholder={t("passwords-links-etc")}
      />
      <div className="flex-row gap-10">
        <span>{t("color")}</span>
        <input
          type="color"
          name="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        className="w-100 padding-5 justify-center"
        text={t("save")}
        svg={SVGS.save}
      />
    </form>
  );
};

const SnaptieCard = ({
  snaptie,
  deleteSnaptie,
}: {
  snaptie: TSnaptie;
  deleteSnaptie: (id: string) => void;
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const copySnaptie = () => {
    navigator.clipboard.writeText(snaptie.content);
    toast.success(t("snaptie.copied"));
  };

  return (
    <div
      style={{ backgroundColor: snaptie.color }}
      className="padding-10 border-gray rounded flex-column gap-5 snaptie-card"
    >
      <h3 className="text-center">{snaptie.title}</h3>
      <div className="flex-row gap-5 justify-center">
        <Button
          className=" justify-center  align-center"
          svg={SVGS.copy}
          onClick={copySnaptie}
        />
        {snaptie.isUrl && (
          <Button
            className=" justify-center align-center"
            svg={SVGS.go}
            onClick={() => window.open(snaptie.content, "_blank")}
          />
        )}
        <Button
          className="justify-center  align-center"
          svg={SVGS.trash}
          confirmations={[
            { text: "", className: "bg-danger", svg: SVGS.trash },
          ]}
          onClick={() => deleteSnaptie(snaptie.id)}
        />
        <Button
          className=" justify-center  align-center"
          svg={SVGS.edit}
          onClick={() => {
            navigate(`/snapties/${snaptie.id}`);
            cacheLocation(`/snapties/${snaptie.id}`);
          }}
        />
      </div>
    </div>
  );
};
