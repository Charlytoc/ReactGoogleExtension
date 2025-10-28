import { useEffect, useState } from "react";
import { TSnaptie } from "../../types";
import { ChromeStorageManager } from "../../managers/Storage";
import { cacheLocation, generateRandomId } from "../../utils/lib";
import { Button } from "../Button/Button";
import { Section } from "../Section/Section";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { LabeledInput } from "../LabeledInput/LabeledInput";
import {
  Search,
  X,
  ArrowLeft,
  Plus,
  ExternalLink,
  Trash2,
  Edit3,
} from "lucide-react";

export const Snapties = () => {
  const [snapties, setSnapties] = useState<TSnaptie[]>([]);
  const [nameFilter, setNameFilter] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<TSnaptie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [navigationMode, setNavigationMode] = useState<
    "search" | "categories" | "snapties"
  >("search");
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    getSnapties();
  }, []);

  // Add keyboard shortcut for accessibility
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle 'q' key when not in form and when we can go back
      if (e.key === "q" && (selectedCategory || isSearching)) {
        e.preventDefault();
        if (selectedCategory) {
          handleBackToCategories();
        } else if (isSearching) {
          handleBackToCategories();
        }
      }
    };

    const handleArrowKeys = (e: KeyboardEvent) => {

      if (
        e.key === "ArrowUp" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight"
      ) {
        e.preventDefault();

        // Check if we're in the search input
        if (e.target instanceof HTMLInputElement && e.target.name === "name-filter") {
          if (e.key === "ArrowDown") {
            // Move from search input to first category
            const searchInput = e.target;
            searchInput.blur(); // Remove focus from input
            setSelectedIndex(0);
            setNavigationMode("categories");
            
            // Focus the first category element
            setTimeout(() => {
              const categoryElements = document.querySelectorAll("[data-category-index]");
              const firstCategory = categoryElements[0] as HTMLElement;
              if (firstCategory) {
                firstCategory.focus();
                firstCategory.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                  inline: "center",
                });
              }
            }, 0);
          }
          return;
        }

        if (selectedCategory || isSearching) {
          // Navigation in snapties view
          handleSnaptiesNavigation(e.key);
        } else {
          // Navigation in categories view
          handleCategoriesNavigation(e.key);
        }
      }
    };

    const handleEnterKey = (e: KeyboardEvent) => {

      // Don't interfere with form submission (search form)
      if (e.target instanceof HTMLInputElement && e.target.name === "name-filter") {
        return; // Let the form handle the submission
      }

      // Don't handle if the event is coming from a snaptie card (it has its own handler)
      if (e.target instanceof HTMLElement && e.target.hasAttribute('data-snaptie-index')) {
        return; // Let the snaptie card handle it
      }

      if (e.key === "Enter") {
        e.preventDefault();
        
        if (navigationMode === "categories" && selectedIndex >= 0) {
          // Enter selected category
          const categories = Object.keys(categoriesToShow);
          if (categories[selectedIndex]) {
            handleCategoryClick(categories[selectedIndex]);
          }
        }
      }
    };

    const handleSpaceKey = (e: KeyboardEvent) => {

      // Don't handle if the event is coming from a snaptie card (it has its own handler)
      if (e.target instanceof HTMLElement && e.target.hasAttribute('data-snaptie-index')) {
        return; // Let the snaptie card handle it
      }

      if (e.key === " ") {
        e.preventDefault();
        
        if (navigationMode === "snapties" && selectedIndex >= 0) {
          // Copy selected snaptie content
          const currentSnapties = selectedCategory ? filteredSnapties : searchResults;
          if (currentSnapties[selectedIndex]) {
            navigator.clipboard.writeText(currentSnapties[selectedIndex].content);
            toast.success(t("snaptie.copied"));
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    document.addEventListener("keydown", handleArrowKeys);
    document.addEventListener("keydown", handleEnterKey);
    document.addEventListener("keydown", handleSpaceKey);
    return () => {
      document.removeEventListener("keydown", handleKeyPress);
      document.removeEventListener("keydown", handleArrowKeys);
      document.removeEventListener("keydown", handleEnterKey);
      document.removeEventListener("keydown", handleSpaceKey);
    };
  }, [
    selectedCategory,
    isSearching,
    selectedIndex,
    snapties,
    searchResults,
    navigationMode,
    t,
  ]);

  const getSnapties = async () => {
    const snapties = await ChromeStorageManager.get("snapties");
    if (snapties && Array.isArray(snapties)) {
      setSnapties(snapties);
    }
  };


  const addSnaptie = async () => {
    const bodyElement = document.body;
    const styles = getComputedStyle(bodyElement);
    const cssVariableValue = styles.getPropertyValue("--bg-color");

    const defaultSnaptie: TSnaptie = {
      id: generateRandomId("snaptie"),
      title: "",
      content: "",
      category: "",
      color: cssVariableValue,
      createdAt: new Date().toISOString(),
      isUrl: false,
    };

    const previousSnapties = await ChromeStorageManager.get("snapties");
    if (previousSnapties) {
      ChromeStorageManager.add("snapties", [...previousSnapties, defaultSnaptie]);
    } else {
      ChromeStorageManager.add("snapties", [defaultSnaptie]);
    }
    
    cacheLocation(`/snapties/${defaultSnaptie.id}`, "/snapties");
    navigate(`/snapties/${defaultSnaptie.id}`);
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
        // If we're in the first row (index 0, 1, 2) and press up, focus the search field
        if (selectedIndex <= 2) {
          const searchInput = document.querySelector('input[name="name-filter"]') as HTMLInputElement;
          if (searchInput) {
            searchInput.focus();
            setSelectedIndex(-1);
            setNavigationMode("search");
            return;
          }
        }
        newIndex = Math.max(selectedIndex - 3, 0);
        break;
    }

    setSelectedIndex(newIndex);
    setNavigationMode("categories");

    // Focus the selected element and scroll to keep it in view
    setTimeout(() => {
      const categoryElements = document.querySelectorAll(
        "[data-category-index]"
      );
      const selectedElement = categoryElements[newIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.focus();
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

    // Focus the selected element and scroll to keep it in view
    setTimeout(() => {
      const snaptieElements = document.querySelectorAll("[data-snaptie-index]");
      const selectedElement = snaptieElements[newIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.focus();
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
        // Focus the first snaptie
        setTimeout(() => {
          const snaptieElements = document.querySelectorAll("[data-snaptie-index]");
          const firstSnaptie = snaptieElements[0] as HTMLElement;
          if (firstSnaptie) {
            firstSnaptie.focus();
          }
        }, 0);
      }
    } else if (navigationMode !== "search") {
      // In categories view, select first category if available
      const categories = Object.keys(categoriesToShow);
      if (categories.length > 0 && selectedIndex === -1) {
        setSelectedIndex(0);
        setNavigationMode("categories");
        // Focus the first category
        setTimeout(() => {
          const categoryElements = document.querySelectorAll("[data-category-index]");
          const firstCategory = categoryElements[0] as HTMLElement;
          if (firstCategory) {
            firstCategory.focus();
          }
        }, 0);
      }
    }
  }, [
    selectedCategory,
    isSearching,
    filteredSnapties,
    searchResults,
    categoriesToShow,
    selectedIndex,
    navigationMode,
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
          onClick={addSnaptie}
          svg={<Plus size={20} />}
        />
      }
    >
      {showSearchView ? (
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
              onKeyDown={(e) => {
                e.stopPropagation();
              }}
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

  const openLink = () => {
    window.open(snaptie.content, "_blank");
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
          e.preventDefault();
          if (snaptie.isUrl) {
            openLink();
          } else {
            pasteSnaptie();
          }
        } else if (e.key === " ") {
          e.preventDefault();
          pasteSnaptie();
        }
      }}
      tabIndex={0}
      role="button"
      data-snaptie-index={index}
      aria-label={`${snaptie.title} - ${snaptie.category} category. ${snaptie.isUrl ? 'Press Enter to open link, Space to copy. Click to copy content.' : 'Press Enter or Space to copy content. Click to copy content.'}`}
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
