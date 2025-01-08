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
          <div className="flex-row gap-10 wrap justify-center">
            {snapties.map((snaptie) => (
              <SnaptieCard
                key={snaptie.id}
                snaptie={snaptie}
                deleteSnaptie={deleteSnaptie}
              />
            ))}
          </div>
        </>
      )}
    </Section>
  );
};

const SnaptieForm = ({ close }: { close: () => void }) => {
  const saveSnaptie = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;

    const newSnaptie = {
      id: generateRandomId("snaptie"),
      title,
      content,
      createdAt: new Date().toISOString(),
      isUrl: isUrl(content),
    };
    const previousSnapties = await ChromeStorageManager.get("snapties");
    if (previousSnapties) {
      ChromeStorageManager.add("snapties", [...previousSnapties, newSnaptie]);
    } else {
      ChromeStorageManager.add("snapties", [newSnaptie]);
    }
    close();
  };

  return (
    <form onSubmit={saveSnaptie}>
      <input
        className="input w-100 padding-10"
        type="text"
        placeholder="Title"
        name="title"
      />
      <input
        className="input w-100 padding-10"
        type="text"
        placeholder="Content"
        name="content"
      />
      <Button className="w-100" svg={SVGS.save} />
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
  const { t } = useTranslation();

  const copySnaptie = () => {
    navigator.clipboard.writeText(snaptie.content);
    toast.success(t("snaptie.copied"));
  };

  return (
    <div className="padding-5 border-gray rounded">
      <h3>{snaptie.title}</h3>
      <div className="flex-row gap-5">
        <Button
          className="padding-5 justify-center w-100 align-center"
          svg={SVGS.copy}
          onClick={copySnaptie}
        />
        {snaptie.isUrl && (
          <Button
            className="padding-5 justify-center w-100 align-center"
            svg={SVGS.go}
            onClick={() => window.open(snaptie.content, "_blank")}
          />
        )}
        <Button
          className="padding-5 justify-center w-100 align-center"
          svg={SVGS.trash}
          confirmations={[
            { text: t("sure?"), className: "bg-danger", svg: SVGS.trash },
          ]}
          onClick={() => deleteSnaptie(snaptie.id)}
        />
      </div>
    </div>
  );
};
