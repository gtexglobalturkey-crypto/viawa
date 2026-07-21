import {
  Building2,
  LoaderCircle,
  LogOut,
  Search,
  Store,
  UserRound,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../feedback/toastContext";
import { useAuth } from "../../features/auth/AuthContext";
import { useGlobalSearch } from "../../modules/global-search/hooks/useGlobalSearch";

import { useWorkspaceHeader } from "./workspaceHeaderContext";

export function Topbar() {
  const navigate = useNavigate();

  const { signOut, user } = useAuth();
  const { showToast } = useToast();

  const {
    aiConfidence,
    aiConfidenceLabel,
  } = useWorkspaceHeader();

  const searchContainerRef =
    useRef<HTMLDivElement | null>(null);

  const [query, setQuery] =
    useState("");

  const [isOpen, setIsOpen] =
    useState(false);

  const [isSigningOut, setIsSigningOut] =
    useState(false);

  const {
    results,
    loading,
    error,
  } = useGlobalSearch(query);

  useEffect(() => {
    function handlePointerDown(
      event: MouseEvent,
    ) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(
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

  function handleResultSelect(
    path: string,
  ) {
    setQuery("");
    setIsOpen(false);
    navigate(path);
  }

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();

      showToast(
        "Çıkış yapıldı.",
        "success",
      );
    } catch (signOutError) {
      console.error(
        "ATLAS sign out error:",
        signOutError,
      );

      showToast(
        "Çıkış başarısız oldu. Lütfen tekrar deneyin.",
        "error",
      );
    } finally {
      setIsSigningOut(false);
    }
  }

  function getResultIcon(
    type:
      | "company"
      | "contact"
      | "exhibition",
  ) {
    if (type === "company") {
      return <Building2 size={16} />;
    }

    if (type === "contact") {
      return <UserRound size={16} />;
    }

    return <Store size={16} />;
  }

  function getResultTypeLabel(
    type:
      | "company"
      | "contact"
      | "exhibition",
  ) {
    if (type === "company") {
      return "Şirket";
    }

    if (type === "contact") {
      return "Kişi";
    }

    return "Fuar";
  }

  const hasQuery =
    query.trim().length > 0;

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Kullanıcı";

  const isGenericAdminName =
    displayName.trim().toLowerCase() ===
    "admin";

  return (
    <header className="atlas-topbar">
      <div className="topbar-welcome">
        <p className="eyebrow">
          Atlas CRM v2
        </p>

        <h2>
          {isGenericAdminName
            ? "Hoş geldiniz"
            : `Hoş geldiniz, ${displayName}`}
        </h2>
      </div>

      {aiConfidence !== null && (
        <div className="topbar-ai-confidence">
          <span>AI Confidence</span>

          <strong>
            {aiConfidence}%
          </strong>

          <small>
            {aiConfidenceLabel}
          </small>
        </div>
      )}

      <div className="topbar-actions">
        <div
          ref={searchContainerRef}
          className="global-search"
        >
          <div className="search-box">
            <Search size={16} />

            <input
              className="topbar-search-input"
              type="search"
              placeholder="Atlas'ta ara..."
              value={query}
              autoComplete="off"
              onFocus={() =>
                setIsOpen(true)
              }
              onChange={(event) => {
                setQuery(
                  event.target.value,
                );

                setIsOpen(true);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Escape"
                ) {
                  setIsOpen(false);
                }

                if (
                  event.key === "Enter" &&
                  results[0]
                ) {
                  handleResultSelect(
                    results[0].path,
                  );
                }
              }}
            />

            {loading && (
              <LoaderCircle
                className="spin"
                size={16}
              />
            )}
          </div>

          {isOpen && hasQuery && (
            <div className="search-results">
              {error && (
                <p className="muted">
                  {error}
                </p>
              )}

              {!loading &&
                !error &&
                results.length === 0 && (
                  <p className="muted">
                    Eşleşen sonuç yok.
                  </p>
                )}

              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  className="search-result-item"
                  onClick={() =>
                    handleResultSelect(
                      result.path,
                    )
                  }
                >
                  {getResultIcon(
                    result.type,
                  )}

                  <span>
                    <strong>
                      {result.title}
                    </strong>

                    <small>
                      {result.subtitle ||
                        getResultTypeLabel(
                          result.type,
                        )}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          className="topbar-signout-button"
          onClick={handleSignOut}
          disabled={isSigningOut}
        >
          <LogOut size={16} />

          {isSigningOut
            ? "Çıkış yapılıyor..."
            : "Çıkış yap"}
        </button>
      </div>
    </header>
  );
}