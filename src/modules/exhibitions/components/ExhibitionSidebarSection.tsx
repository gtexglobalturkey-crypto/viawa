import {
  ChevronDown,
  ChevronUp,
  Landmark,
  Plus,
} from "lucide-react";
import { useState } from "react";
import type { MouseEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "../../../components/feedback/toastContext";
import {
  createExhibition,
  getExhibitions,
} from "../../../services/supabase/exhibitionService";
import type { Exhibition } from "../models/Exhibition";
import { saveExhibitions } from "../storage/exhibitionStorage";
import { exhibitionNamesMatch } from "../utils/exhibitionNameMatch";

import { ExhibitionCreateModal } from "./ExhibitionCreateModal";

type ExhibitionSidebarSectionProps = {
  exhibitions: Exhibition[];
  onExhibitionsChange: (
    exhibitions: Exhibition[],
  ) => void;
  selectedExhibitionId: string | null;
  onSelectExhibition: (
    id: string,
  ) => void;
  loading: boolean;
  error: string | null;
};

export function ExhibitionSidebarSection({
  exhibitions,
  onExhibitionsChange,
  selectedExhibitionId,
  onSelectExhibition,
  loading,
  error,
}: ExhibitionSidebarSectionProps) {
  const [isExpanded, setIsExpanded] =
    useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] =
    useState(false);

  const [
    matchingRepositoryId,
    setMatchingRepositoryId,
  ] = useState<string | null>(null);

  const navigate = useNavigate();
  const { showToast } = useToast();

  // Creates the real Supabase exhibitions row FIRST — the sidebar's
  // localStorage list is only updated once that succeeds, using the
  // real row's id (not the modal's throwaway placeholder id), so the
  // sidebar entry and "Repository'yi Aç"'s fuzzy name match always
  // refer to the exact same underlying fuar. If a Supabase exhibition
  // with a matching name already exists, that row is reused instead of
  // creating a duplicate.
  async function handleCreate(
    exhibition: Exhibition,
  ): Promise<boolean> {
    try {
      const dbExhibitions =
        await getExhibitions();

      const existingMatch =
        dbExhibitions.find(
          (candidate) =>
            exhibitionNamesMatch(
              candidate.name,
              exhibition.name,
            ) ||
            exhibitionNamesMatch(
              candidate.name,
              exhibition.shortName,
            ),
        );

      const supabaseExhibition =
        existingMatch ??
        (await createExhibition({
          name: exhibition.name,
          city:
            exhibition.city ?? null,
          country:
            exhibition.country ??
            null,
          sector: null,
          organizer: null,
          start_date:
            exhibition.startDate ??
            null,
          end_date:
            exhibition.endDate ??
            null,
        }));

      const localExhibition: Exhibition =
        {
          ...exhibition,
          id: supabaseExhibition.id,
        };

      const alreadyInLocalList =
        exhibitions.some(
          (existing) =>
            existing.id ===
            supabaseExhibition.id,
        );

      const next = alreadyInLocalList
        ? exhibitions
        : [
            ...exhibitions,
            localExhibition,
          ];

      onExhibitionsChange(next);
      saveExhibitions(next);
      setIsExpanded(true);

      showToast(
        existingMatch
          ? "Bu isimde bir fuar zaten mevcut, mevcut kayıt kullanıldı."
          : "Fuar oluşturuldu ve Repository'ye bağlandı.",
        existingMatch
          ? "info"
          : "success",
      );

      return true;
    } catch (createError) {
      console.error(
        "Exhibition create error:",
        createError,
      );

      showToast(
        "Fuar oluşturulamadı. Lütfen tekrar deneyin.",
        "error",
      );

      return false;
    }
  }

  // The sidebar's Exhibition (localStorage-only, see
  // storage/exhibitionStorage.ts) is a separate identity from the real
  // Supabase `exhibitions` table the Repository is keyed to (Sprint
  // 22.1) — matched here by name with the same exhibitionNamesMatch
  // fuzzy logic Sprint 22.2's live Price Calculator already uses, so
  // "Repository'yi Aç" resolves to the same fuar the pricing flow would.
  //
  // event.preventDefault()/stopPropagation() run first and unconditionally
  // — this button sits inside the same sidebar list as the fuar-select
  // button (a sibling, not a parent), and must never let its click be
  // interpreted as anything other than "open this exhibition's
  // Repository," regardless of what else is listening up the tree.
  async function handleOpenRepository(
    event: MouseEvent<HTMLButtonElement>,
    exhibition: Exhibition,
  ): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    setMatchingRepositoryId(
      exhibition.id,
    );

    try {
      let dbExhibitions: Awaited<
        ReturnType<typeof getExhibitions>
      >;

      try {
        dbExhibitions =
          await getExhibitions();
      } catch (requestError) {
        console.error(
          "Exhibition repository lookup request failed:",
          requestError,
        );

        showToast(
          "Repository açılırken bir hata oluştu.",
          "error",
        );

        return;
      }

      if (dbExhibitions.length === 0) {
        showToast(
          "Bu fuar için Repository kaydı bulunamadı.",
          "error",
        );

        return;
      }

      const matchedExhibition =
        dbExhibitions.find(
          (candidate) =>
            exhibitionNamesMatch(
              candidate.name,
              exhibition.name,
            ) ||
            exhibitionNamesMatch(
              candidate.name,
              exhibition.shortName,
            ),
        );

      if (
        !matchedExhibition ||
        !matchedExhibition.id.trim()
      ) {
        showToast(
          "Bu fuar için Repository kaydı bulunamadı.",
          "error",
        );

        return;
      }

      navigate(
        `/exhibitions/${matchedExhibition.id}/repository`,
      );
    } finally {
      setMatchingRepositoryId(null);
    }
  }

  return (
    <>
      <div className="exhibitions-header-row">
        <button
          type="button"
          className="viawa-nav-item exhibitions-toggle-button"
          aria-expanded={isExpanded}
          onClick={() =>
            setIsExpanded((current) => !current)
          }
        >
          <Landmark size={16} />
          <span className="exhibitions-toggle-label">
            Fuarlar
          </span>
          {isExpanded ? (
            <ChevronUp size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
        </button>

        <button
          type="button"
          className="exhibitions-add-button"
          aria-label="Yeni fuar ekle"
          onClick={() =>
            setIsCreateModalOpen(true)
          }
        >
          <Plus size={14} />
        </button>
      </div>

      {isExpanded && (
        <div className="exhibitions-list">
          {loading ? (
            <p className="exhibitions-list-empty">
              Fuarlar yükleniyor...
            </p>
          ) : error && exhibitions.length === 0 ? (
            <p className="exhibitions-list-empty" role="alert">
              {error}
            </p>
          ) : exhibitions.length === 0 ? (
            <p className="exhibitions-list-empty">
              Henüz fuar eklenmedi
            </p>
          ) : (
            <>
              {error ? (
                <p className="exhibitions-list-empty" role="alert">
                  {error}
                </p>
              ) : null}
              {exhibitions.map((exhibition) => {
                const isSelected =
                  selectedExhibitionId ===
                  exhibition.id;

                return (
                  <div
                    key={exhibition.id}
                    className="exhibitions-list-row"
                  >
                    <button
                      type="button"
                      className={`exhibitions-list-item${
                        isSelected
                          ? " active"
                          : ""
                      }`}
                      onClick={() =>
                        onSelectExhibition(
                          exhibition.id,
                        )
                      }
                    >
                      <span className="exhibitions-list-item-label">
                        {
                          exhibition.shortName
                        }
                      </span>
                    </button>

                    {isSelected ? (
                      <button
                        type="button"
                        className="exhibitions-repository-button"
                        disabled={
                          matchingRepositoryId ===
                          exhibition.id
                        }
                        onClick={(
                          event,
                        ) =>
                          void handleOpenRepository(
                            event,
                            exhibition,
                          )
                        }
                      >
                        {matchingRepositoryId ===
                        exhibition.id
                          ? "Aranıyor..."
                          : "Repository'yi Aç"}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      <ExhibitionCreateModal
        open={isCreateModalOpen}
        onClose={() =>
          setIsCreateModalOpen(false)
        }
        onCreate={handleCreate}
      />
    </>
  );
}
