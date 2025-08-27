import { useEffect, useState } from "react";
import { TSnaptie } from "../../types";
import { ChromeStorageManager } from "../../managers/Storage";
import { cacheLocation, generateRandomId, isUrl } from "../../utils/lib";
import { Button } from "../Button/Button";
import { Section } from "../Section/Section";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { LabeledInput } from "../LabeledInput/LabeledInput";
import { Textarea } from "../Textarea/Textarea";
import {
  Search,
  X,
  ArrowLeft,
  Plus,
  ExternalLink,
  Trash2,
  Edit3,
  Copy,
} from "lucide-react";

export const Snapties = () => {
  const [snapties, setSnapties] = useState<TSnaptie[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [nameFilter, setNameFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<TSnaptie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [navigationMode, setNavigationMode] = useState<
    "categories" | "snapties"
  >("categories");
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    getSnapties();
  }, []);

  // Add keyboard shortcut for accessibility
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle 'q' key when not in form and when we can go back
      if (e.key === "q" && !showForm && (selectedCategory || isSearching)) {
        e.preventDefault();
        if (selectedCategory) {
          handleBackToCategories();
        } else if (isSearching) {
          handleBackToCategories();
        }
      }
    };

    const handleArrowKeys = (e: KeyboardEvent) => {
      if (showForm) return; // Don't handle navigation when form is open

      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();

        if (selectedCategory || isSearching) {
          // Navigation in snapties view
          handleSnaptiesNavigation(e.key);
        } else {
          // Navigation in categories view
          handleCategoriesNavigation(e.key);
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    document.addEventListener("keydown", handleArrowKeys);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      document.removeEventListener("keydown", handleArrowKeys);
    };
  }, [
    showForm,
    selectedCategory,
    isSearching,
    selectedIndex,
    snapties,
    searchResults,
  ]);

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
    // Also remove from search results if present
    setSearchResults((prev) => prev.filter((snaptie) => snaptie.id !== id));
  };

  // Get all categories (for when no filter is applied)
  const allCategories =
    snapties && snapties.length > 0
      ? snapties.reduce((acc, snaptie) => {
          const category = snaptie.category || t("uncategorized");
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(snaptie);
          return acc;
        }, {} as Record<string, TSnaptie[]>)
      : {};

  // While typing: search all snapdeals and show categories that contain matching snapdeals
  const matchingSnapdeals = nameFilter
    ? snapties.filter((snaptie) => {
        const titleIncludes = snaptie.title
          .toLowerCase()
          .includes(nameFilter.toLowerCase());
        const contentIncludes = snaptie.content
          .toLowerCase()
          .includes(nameFilter.toLowerCase());
        const categoryIncludes = snaptie.category
          .toLowerCase()
          .includes(nameFilter.toLowerCase());
        return titleIncludes || contentIncludes || categoryIncludes;
      })
    : [];

  // Get categories that contain matching snapdeals (for filtered view)
  const filteredCategories =
    matchingSnapdeals.length > 0
      ? matchingSnapdeals.reduce((acc, snaptie) => {
          const category = snaptie.category || t("uncategorized");
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(snaptie);
          return acc;
        }, {} as Record<string, TSnaptie[]>)
      : {};

  const handleCategoriesNavigation = (key: string) => {
    const categories = Object.keys(categoriesToShow);
    if (categories.length === 0) return;

    let newIndex = selectedIndex;

    switch (key) {
      case "ArrowRight":
        newIndex = Math.min(selectedIndex + 1, categories.length - 1);
        break;
      case "ArrowLeft":
        newIndex = Math.max(selectedIndex - 1, 0);
        break;
      case "ArrowDown":
        newIndex = Math.min(selectedIndex + 3, categories.length - 1);
        break;
      case "ArrowUp":
        newIndex = Math.max(selectedIndex - 3, 0);
        break;
    }

    setSelectedIndex(newIndex);
    setNavigationMode("categories");

    // Scroll to keep selected element in view
    setTimeout(() => {
      const categoryElements = document.querySelectorAll(
        "[data-category-index]"
      );
      const selectedElement = categoryElements[newIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }
    }, 0);
  };

  const handleSnaptiesNavigation = (key: string) => {
    const currentSnapties = selectedCategory ? filteredSnapties : searchResults;
    if (currentSnapties.length === 0) return;

    let newIndex = selectedIndex;

    switch (key) {
      case "ArrowRight":
        newIndex = Math.min(selectedIndex + 1, currentSnapties.length - 1);
        break;
      case "ArrowLeft":
        newIndex = Math.max(selectedIndex - 1, 0);
        break;
      case "ArrowDown":
        newIndex = Math.min(selectedIndex + 4, currentSnapties.length - 1);
        break;
      case "ArrowUp":
        newIndex = Math.max(selectedIndex - 4, 0);
        break;
    }

    setSelectedIndex(newIndex);
    setNavigationMode("snapties");

    // Scroll to keep selected element in view
    setTimeout(() => {
      const snaptieElements = document.querySelectorAll("[data-snaptie-index]");
      const selectedElement = snaptieElements[newIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "center",
        });
      }
    }, 0);
  };

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setSelectedIndex(-1); // Reset selection when entering category
    setNavigationMode("snapties");
    // Don't clear the filter when navigating to category
    // setSearchResults([]);
    // setIsSearching(false);
  };

  const handleBackToCategories = () => {
    setSelectedCategory(null);
    setSelectedIndex(-1); // Reset selection when going back
    setNavigationMode("categories");
    // Don't clear the filter when going back - preserve search context
    // setNameFilter("");
    setSearchResults([]);
    setIsSearching(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameFilter.trim()) {
      setSearchResults(matchingSnapdeals);
      setIsSearching(true);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  // Use allCategories when navigating to a specific category, filteredCategories when showing filtered view
  const categoriesToShow = selectedCategory
    ? allCategories
    : nameFilter
    ? filteredCategories
    : allCategories;

  // Apply filter to selected category if there's a filter active
  const filteredSnapties = selectedCategory
    ? nameFilter
      ? allCategories[selectedCategory]?.filter((snaptie) => {
          const titleIncludes = snaptie.title
            .toLowerCase()
            .includes(nameFilter.toLowerCase());
          const contentIncludes = snaptie.content
            .toLowerCase()
            .includes(nameFilter.toLowerCase());
          const categoryIncludes = snaptie.category
            .toLowerCase()
            .includes(nameFilter.toLowerCase());
          return titleIncludes || contentIncludes || categoryIncludes;
        }) || []
      : allCategories[selectedCategory] || []
    : [];

  // Show search results even if empty when there's a search query
  const showSearchView = isSearching && !selectedCategory;

  // Set initial selection when categories or snapties change
  useEffect(() => {
    if (selectedCategory || isSearching) {
      // In snapties view, select first item if available
      const currentSnapties = selectedCategory
        ? filteredSnapties
        : searchResults;
      if (currentSnapties.length > 0 && selectedIndex === -1) {
        setSelectedIndex(0);
        setNavigationMode("snapties");
      }
    } else {
      // In categories view, select first category if available
      const categories = Object.keys(categoriesToShow);
      if (categories.length > 0 && selectedIndex === -1) {
        setSelectedIndex(0);
        setNavigationMode("categories");
      }
    }
  }, [
    selectedCategory,
    isSearching,
    filteredSnapties,
    searchResults,
    categoriesToShow,
    selectedIndex,
  ]);

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
          svg={showForm ? <X size={20} /> : <Plus size={20} />}
        />
      }
    >
      {showForm ? (
        <SnaptieForm close={closeAndRefresh} />
      ) : showSearchView ? (
        // Show search results
        <div className="flex-column gap-10">
          <div className="flex-row gap-10 align-center">
            <Button
              className="padding-5"
              onClick={handleBackToCategories}
              svg={<ArrowLeft size={20} />}
              text={t("back-to-categories")}
            />
            <h4 className="font-mono">{t("search-results")}</h4>
            <span className="text-sm text-gray-600 ml-auto">
              {t("press-q-to-go-back")}
            </span>
          </div>
          <div className="text-sm text-gray-600 text-center padding-10">
            {t("use-arrow-keys-to-navigate")}
          </div>
          {searchResults.length === 0 ? (
            <div className="text-center text-gray-600 padding-20">
              {t("no-snapdeals-found")}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-5">
              {searchResults.map((snaptie, index) => (
                <SnaptieCard
                  key={snaptie.id}
                  snaptie={snaptie}
                  deleteSnaptie={deleteSnaptie}
                  isSelected={
                    navigationMode === "snapties" && selectedIndex === index
                  }
                  onFocus={() => {
                    setSelectedIndex(index);
                    setNavigationMode("snapties");
                  }}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      ) : selectedCategory ? (
        // Show snapdeals for selected category
        <div className="flex-column gap-10">
          <div className="flex-row gap-10 align-center">
            <Button
              className="padding-5"
              onClick={handleBackToCategories}
              svg={<ArrowLeft size={20} />}
              title={t("back-to-categories")}
            />
            <h4 className="font-mono">{selectedCategory}</h4>
            <span className="text-sm text-gray-600 ml-auto">
              {t("press-q-to-go-back")}
            </span>
          </div>
          <div className="text-sm text-gray-600 text-center padding-10">
            {t("use-arrow-keys-to-navigate")}
          </div>
          {filteredSnapties.length === 0 ? (
            <div className="text-center text-gray-600 padding-20">
              {nameFilter
                ? t("no-snapdeals-in-category-with-filter")
                : t("no-snapdeals-in-category")}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-5">
              {filteredSnapties.map((snaptie, index) => (
                <SnaptieCard
                  key={snaptie.id}
                  snaptie={snaptie}
                  deleteSnaptie={deleteSnaptie}
                  isSelected={
                    navigationMode === "snapties" && selectedIndex === index
                  }
                  onFocus={() => {
                    setSelectedIndex(index);
                    setNavigationMode("snapties");
                  }}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        // Show categories (filtered based on matching snapdeals)
        <div className="flex-column gap-10">
          <form onSubmit={handleSearch} className="flex-row gap-10">
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
            <Button
              type="submit"
              className="padding-5"
              svg={<Search size={20} />}
              aria-label={t("search")}
            />
            {nameFilter && (
              <Button
                className="padding-5"
                onClick={() => {
                  setNameFilter("");
                  setSearchResults([]);
                  setIsSearching(false);
                }}
                svg={<X size={20} />}
                aria-label={t("clear-search")}
                title={t("clear-search-tooltip")}
              />
            )}
          </form>
          <h4 className="font-mono text-center">
            {nameFilter ? t("matching-categories") : t("categories")}
          </h4>
          <div className="text-sm text-gray-600 text-center padding-10">
            {t("use-arrow-keys-to-navigate")}
          </div>
          {Object.keys(categoriesToShow).length === 0 ? (
            <div className="text-center text-gray-600 padding-20">
              {nameFilter
                ? t("no-categories-found")
                : t("no-categories-available")}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-10">
              {Object.entries(categoriesToShow).map(
                ([category, categorySnapties], index) => (
                  <CategoryCard
                    key={category}
                    category={category}
                    count={(categorySnapties as TSnaptie[]).length}
                    onClick={() => handleCategoryClick(category)}
                    isSelected={
                      navigationMode === "categories" && selectedIndex === index
                    }
                    onFocus={() => {
                      setSelectedIndex(index);
                      setNavigationMode("categories");
                    }}
                    index={index}
                  />
                )
              )}
            </div>
          )}
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
        svg={<Copy size={20} />}
      />
    </form>
  );
};

const SnaptieCard = ({
  snaptie,
  deleteSnaptie,
  isSelected,
  onFocus,
  index,
}: {
  snaptie: TSnaptie;
  deleteSnaptie: (id: string) => void;
  isSelected?: boolean;
  onFocus?: () => void;
  index?: number;
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
      className={`padding-10 border-gray rounded flex-column gap-5 pointer scale-on-hover pos-relative ${
        isSelected ? " scale-105" : ""
      }`}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          pasteSnaptie();
        }
      }}
      tabIndex={0}
      role="button"
      data-snaptie-index={index}
      aria-label={`${snaptie.title} - ${snaptie.category} category. Click to copy content.`}
    >
      <div className="snaptie-bg" onClick={pasteSnaptie}></div>
      <h4 className="text-center">{snaptie.title.slice(0, 20)}</h4>
      <div className="flex-row gap-5 justify-center">
        {snaptie.isUrl && (
          <Button
            className=" justify-center align-center"
            tabIndex={0}
            svg={<ExternalLink size={20} />}
            onClick={() => window.open(snaptie.content, "_blank")}
            aria-label={`Open ${snaptie.title} in new tab`}
          />
        )}
        <Button
          className="  "
          tabIndex={0}
          svg={<Trash2 size={20} />}
          confirmations={[
            { text: t("sure?"), className: "bg-danger", svg: undefined },
          ]}
          onClick={() => deleteSnaptie(snaptie.id)}
          aria-label={`Delete ${snaptie.title}`}
        />
        <Button
          tabIndex={0}
          className=" justify-center  align-center above text-center "
          svg={<Edit3 size={20} />}
          onClick={() => {
            navigate(`/snapties/${snaptie.id}`);
            cacheLocation(`/snapties/${snaptie.id}`);
          }}
          aria-label={`Edit ${snaptie.title}`}
        />
      </div>
    </div>
  );
};

// New component for category cards
const CategoryCard = ({
  category,
  count,
  onClick,
  isSelected,
  onFocus,
  index,
}: {
  category: string;
  count: number;
  onClick: () => void;
  isSelected?: boolean;
  onFocus?: () => void;
  index?: number;
}) => {
  return (
    <div
      className={`padding-10 border-gray rounded flex-column gap-5 pointer scale-on-hover text-center ${
        isSelected ? " bg-active-100 font-bold" : ""
      }`}
      onClick={onClick}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick();
        }
      }}
      tabIndex={0}
      role="button"
      data-category-index={index}
      aria-label={`${category} category with ${count} snapdeals`}
    >
      <h4 className="font-mono font-bold text-md text-center">{category}</h4>
      <div className="text-sm text-gray-400">{count} snapties</div>
    </div>
  );
};
