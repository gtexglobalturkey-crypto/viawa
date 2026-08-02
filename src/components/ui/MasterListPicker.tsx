import { X } from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { normalizeMasterListName } from "../../core/normalization/masterListName";

export type MasterListPickerItem = {
  id: string;
  name: string;
};

type Props = {
  label: string;
  addNewLabel: string;
  placeholder?: string;
  selected: MasterListPickerItem[];
  onChange: (
    items: MasterListPickerItem[],
  ) => void;
  onSearch: (
    query: string,
  ) => Promise<MasterListPickerItem[]>;
  onCreate: (
    name: string,
  ) => Promise<MasterListPickerItem>;
  maxItems?: number;
  primaryLabel?: string;
  disabled?: boolean;
};

const SEARCH_DEBOUNCE_MS = 250;

export function MasterListPicker({
  label,
  addNewLabel,
  placeholder = "Ara veya ekle...",
  selected,
  onChange,
  onSearch,
  onCreate,
  maxItems = 4,
  primaryLabel,
  disabled = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<
    MasterListPickerItem[]
  >([]);
  const [isSearching, setIsSearching] =
    useState(false);
  const [isCreating, setIsCreating] =
    useState(false);

  const containerRef =
    useRef<HTMLDivElement | null>(null);

  const atLimit =
    selected.length >= maxItems;

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    let isActive = true;

    setIsSearching(true);

    const timeoutId = window.setTimeout(
      () => {
        onSearch(trimmedQuery)
          .then((found) => {
            if (isActive) {
              setResults(found);
            }
          })
          .catch(() => {
            if (isActive) {
              setResults([]);
            }
          })
          .finally(() => {
            if (isActive) {
              setIsSearching(false);
            }
          });
      },
      SEARCH_DEBOUNCE_MS,
    );

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
    };
  }, [query, onSearch]);

  useEffect(() => {
    function handlePointerDown(
      event: MouseEvent,
    ) {
      if (
        containerRef.current &&
        !containerRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handlePointerDown,
      );
    };
  }, []);

  function isAlreadySelected(
    name: string,
  ): boolean {
    const normalized =
      normalizeMasterListName(name);

    return selected.some(
      (item) =>
        normalizeMasterListName(
          item.name,
        ) === normalized,
    );
  }

  function selectItem(
    item: MasterListPickerItem,
  ) {
    if (atLimit) {
      return;
    }

    if (isAlreadySelected(item.name)) {
      setQuery("");
      setIsOpen(false);
      return;
    }

    onChange([...selected, item]);
    setQuery("");
    setResults([]);
    setIsOpen(false);
  }

  function removeItem(id: string) {
    onChange(
      selected.filter(
        (item) => item.id !== id,
      ),
    );
  }

  async function handleCreate() {
    const trimmedQuery = query.trim();

    if (
      !trimmedQuery ||
      atLimit ||
      isCreating
    ) {
      return;
    }

    setIsCreating(true);

    try {
      const created = await onCreate(
        trimmedQuery,
      );

      selectItem(created);
    } catch (error) {
      console.error(
        `${label} could not be created:`,
        error,
      );
    } finally {
      setIsCreating(false);
    }
  }

  const trimmedQuery = query.trim();

  const hasExactMatch =
    trimmedQuery.length > 0 &&
    results.some(
      (result) =>
        normalizeMasterListName(
          result.name,
        ) ===
        normalizeMasterListName(
          trimmedQuery,
        ),
    );

  return (
    <div
      className="master-list-picker"
      ref={containerRef}
    >
      <span className="master-list-picker-label">
        {label}
        {maxItems ? (
          <em>
            {selected.length}/{maxItems}
          </em>
        ) : null}
      </span>

      {selected.length > 0 && (
        <div className="master-list-picker-chips">
          {selected.map((item, index) => (
            <span
              className="master-list-picker-chip"
              key={item.id}
            >
              {primaryLabel &&
              index === 0 ? (
                <em>{primaryLabel}</em>
              ) : null}
              {item.name}
              {!disabled && (
                <button
                  type="button"
                  aria-label={`${item.name} kaldır`}
                  onClick={() =>
                    removeItem(item.id)
                  }
                >
                  <X size={11} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!disabled && !atLimit && (
        <div className="master-list-picker-input-row">
          <input
            type="text"
            value={query}
            placeholder={placeholder}
            onFocus={() => setIsOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setIsOpen(false);
              }
            }}
          />

          {isOpen && trimmedQuery && (
            <div className="master-list-picker-results">
              {isSearching && (
                <p className="muted">
                  Aranıyor...
                </p>
              )}

              {!isSearching &&
                results.map((result) => (
                  <button
                    type="button"
                    key={result.id}
                    className="master-list-picker-result-item"
                    disabled={isAlreadySelected(
                      result.name,
                    )}
                    onClick={() =>
                      selectItem(result)
                    }
                  >
                    {result.name}
                  </button>
                ))}

              {!isSearching &&
                !hasExactMatch && (
                  <button
                    type="button"
                    className="master-list-picker-create-item"
                    disabled={isCreating}
                    onClick={() => {
                      void handleCreate();
                    }}
                  >
                    {isCreating
                      ? "Ekleniyor..."
                      : `${addNewLabel}: "${trimmedQuery}"`}
                  </button>
                )}
            </div>
          )}
        </div>
      )}

      {atLimit && !disabled && (
        <p className="master-list-picker-limit-hint muted">
          En fazla {maxItems} seçilebilir.
        </p>
      )}
    </div>
  );
}
