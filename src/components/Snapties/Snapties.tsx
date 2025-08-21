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
  const [nameFilter, setNameFilter] = useState("");
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    getSnapties();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [nameFilter]);

  const applyFilters = async () => {
    let snapties: TSnaptie[] = await ChromeStorageManager.get("snapties");
    if (nameFilter) {
      snapties = snapties.filter((snaptie) => {
        const titleIncludes = snaptie.title
          .toLocaleLowerCase()
          .includes(nameFilter.toLocaleLowerCase());
        const contentIncludes = snaptie.content
          .toLocaleLowerCase()
          .includes(nameFilter.toLocaleLowerCase());

        const categoryIncludes = snaptie.category
          .toLocaleLowerCase()
          .includes(nameFilter.toLocaleLowerCase());
        return titleIncludes || contentIncludes || categoryIncludes;
      });
    }
    setSnapties(snapties);
  };

  const getSnapties = async () => {
    const snapties = await ChromeStorageManager.get("snapties");
    if (snapties && Array.isArray(snapties)) {
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

  const categories = snapties &&snapties.length > 0 ? snapties.reduce((acc, snaptie) => {
    if (!acc[snaptie.category]) {
      acc[snaptie.category] = [];
    }
    acc[snaptie.category].push(snaptie);
    return acc;
  }, {} as Record<string, TSnaptie[]>): {};

  return (
    <Section
      
      className="bg-gradient"
      close={() => {
        cacheLocation("/index.html");
        navigate("/index.html");
      }}
      headerLeft={<h3 className="font-mono">Snapties</h3>}
      headerRight={
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
        <div className="flex-column gap-10 ">
          <div className="flex-row gap-10">
            <LabeledInput
              autoFocus
              className="w-100"
              label={t("filter-by-name")}
              name="name-filter"
              type="text"
              placeholder={t("search")}
              value={nameFilter}
              onChange={(e) => setNameFilter(e)}
            />
          </div>
          {Object.entries(categories).map(([category, snapties]) => (
            <div key={category}>
              <h4>{category}</h4>
              <div className="grid grid-cols-4 gap-5">
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
    <form onSubmit={saveSnaptie} className="flex-column gap-10 rounded">
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

  const pasteSnaptie = () => {
    navigator.clipboard.writeText(snaptie.content);
    toast.success(t("snaptie.copied"));
  };

  return (
    <div
      style={{ backgroundColor: snaptie.color }}
      className="padding-10 border-gray rounded flex-column gap-5 pointer scale-on-hover pos-relative"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          pasteSnaptie();
        }
      }}
      tabIndex={0}
    >
      <div className="snaptie-bg" onClick={pasteSnaptie}></div>
      <h4 className="text-center">{snaptie.title.slice(0, 20)}</h4>
      <div className="flex-row gap-5 justify-center">
        {snaptie.isUrl && (
          <Button
            className=" justify-center align-center"
            tabIndex={0}
            svg={SVGS.go}
            onClick={() => window.open(snaptie.content, "_blank")}
          />
        )}
        <Button
          className="  "
          tabIndex={-1}
          svg={SVGS.trash}
          confirmations={[
            { text: t("sure?"), className: "bg-danger", svg: undefined },
          ]}
          onClick={() => deleteSnaptie(snaptie.id)}
        />
        <Button
          tabIndex={-1}
          className=" justify-center  align-center above text-center "
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
