import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Panel } from "../../components/ui/Panel";
import { TopbarSlot } from "../../components/layout/topbarSlotContext";
import { normalizeMasterListName } from "../../core/normalization/masterListName";
import { getCallNotes } from "../../services/supabase/noteService";
import { getCompanies, type Company } from "../../services/supabase/companyService";
import { getContacts, type Contact } from "../../services/supabase/contactService";
import { getExhibitions, type Exhibition } from "../../services/supabase/exhibitionService";
import { getOpportunities, type Opportunity } from "../../services/supabase/opportunityService";
import { listCompanySectorRelations, type CompanySectorRelation } from "../../services/supabase/sectorService";
import { listCompanyProductGroupRelations, listProductGroups, type CompanyProductGroupRelation, type ProductGroup } from "../../services/supabase/productGroupService";
import { COMPANY_STATUS_LABELS, getBusinessStatusLabel, isTerminalBusinessStatus, MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY, resolveCompanyStatus, type CompanyStatusLabel } from "../../types/businessStatus";
import type { CallNote } from "../../types/database";
import { resolveCompanyRowSummary } from "./models/companyRowSummary";
import { buildWorkspacePath, getKanbanColumnId, getLatestCallNoteByCompany, KANBAN_COLUMNS, matchesCompanyStatusFilter, matchesNextAction, matchesPresence, sortCompanyIdsByLastCallNote, type ClosedStageFilter, type LastActivitySort, type NextActionFilter, type PresenceFilter } from "./models/companiesKanban";

type ViewMode = "kanban" | "list";
type StatusFilter = "all" | CompanyStatusLabel;
const clean = (value: string | null | undefined) => value?.replace(/^[a-z][a-z0-9_]*\s*:\s*/i, "").trim() ?? "";
function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
function escapeCsvValue(value: string | number) {
  const text = String(value);
  return /[,"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
const getContactName = (contact?: Contact) => contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() : "";

export function CompaniesPage() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [callNotes, setCallNotes] = useState<CallNote[]>([]);
  const [sectorRelations, setSectorRelations] = useState<CompanySectorRelation[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [productRelations, setProductRelations] = useState<CompanyProductGroupRelation[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [exhibitionFilter, setExhibitionFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [productGroupFilter, setProductGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [lastActivitySort, setLastActivitySort] = useState<LastActivitySort>("newest");
  const [countryFilter, setCountryFilter] = useState("all");
  const [nextActionFilter, setNextActionFilter] = useState<NextActionFilter>("all");
  const [activeOpportunityFilter, setActiveOpportunityFilter] = useState<PresenceFilter>("all");
  const [contactFilter, setContactFilter] = useState<PresenceFilter>("all");
  const [meetingFilter, setMeetingFilter] = useState<PresenceFilter>("all");
  const [closedStageFilter, setClosedStageFilter] = useState<ClosedStageFilter>("active");
  const [moreOpen, setMoreOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const [companyData, contactData, exhibitionData, opportunityData, noteData, sectorData, productData, productRelationData] = await Promise.all([
        getCompanies(), getContacts(), getExhibitions(), getOpportunities(), getCallNotes(),
        listCompanySectorRelations(), listProductGroups(), listCompanyProductGroupRelations(),
      ]);
      setCompanies(companyData); setContacts(contactData); setExhibitions(exhibitionData);
      setOpportunities(opportunityData); setCallNotes(noteData); setSectorRelations(sectorData);
      setProductGroups(productData); setProductRelations(productRelationData);
    } catch (loadError) {
      console.error("Company workspace could not be loaded:", loadError);
      setError("Firma bilgileri yüklenemedi.");
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const companiesById = useMemo(() => new Map(companies.map((item) => [item.id, item])), [companies]);
  const contactsById = useMemo(() => new Map(contacts.map((item) => [item.id, item])), [contacts]);
  const latestCallNotes = useMemo(() => getLatestCallNoteByCompany(callNotes), [callNotes]);
  const countries = useMemo(() => [...new Set(companies.map((item) => clean(item.country)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr")), [companies]);
  const contactCompanyIds = useMemo(() => new Set(contacts.map((item) => item.company_id)), [contacts]);
  const sectorsByCompany = useMemo(() => {
    const map = new Map<string, CompanySectorRelation[]>();
    sectorRelations.forEach((item) => map.set(item.companyId, [...(map.get(item.companyId) ?? []), item]));
    return map;
  }, [sectorRelations]);
  const productsByCompany = useMemo(() => {
    const map = new Map<string, CompanyProductGroupRelation[]>();
    productRelations.forEach((item) => map.set(item.companyId, [...(map.get(item.companyId) ?? []), item]));
    return map;
  }, [productRelations]);
  const industries = useMemo(() => {
    const values = new Map<string, string>();
    sectorRelations.forEach((item) => values.set(normalizeMasterListName(item.name), item.name));
    companies.forEach((item) => { if (item.industry) values.set(normalizeMasterListName(item.industry), clean(item.industry)); });
    return [...values.entries()].sort((a, b) => a[1].localeCompare(b[1], "tr"));
  }, [companies, sectorRelations]);
  const companyRows = useMemo(() => companies.map((company) => {
    const companyOpportunities = opportunities.filter((item) => item.company_id === company.id);
    const summary = resolveCompanyRowSummary(companyOpportunities);
    return {
      company,
      companyOpportunities,
      sectors: sectorsByCompany.get(company.id) ?? [],
      products: productsByCompany.get(company.id) ?? [],
      ...summary,
      companyStatus: resolveCompanyStatus(companyOpportunities),
    };
  }), [companies, opportunities, productsByCompany, sectorsByCompany]);
  const filteredRows = useMemo(() => {
    const rows = companyRows.filter((row) =>
      (exhibitionFilter === "all" || row.companyOpportunities.some((item) => item.exhibition_id === exhibitionFilter)) &&
      (industryFilter === "all" || row.sectors.some((item) => normalizeMasterListName(item.name) === industryFilter) || normalizeMasterListName(row.company.industry ?? "") === industryFilter) &&
      (productGroupFilter === "all" || row.products.some((item) => item.productGroupId === productGroupFilter)) &&
      (viewMode === "kanban" || matchesCompanyStatusFilter(row.companyStatus, statusFilter)) &&
      (countryFilter === "all" || clean(row.company.country) === countryFilter) &&
      matchesPresence(latestCallNotes.has(row.company.id), meetingFilter) &&
      (viewMode === "kanban" || (
        matchesNextAction(row.nextOpportunity, nextActionFilter) &&
        matchesPresence(row.activeOpportunities.length > 0, activeOpportunityFilter) &&
        matchesPresence(contactCompanyIds.has(row.company.id), contactFilter)
      )));
    const ids = sortCompanyIdsByLastCallNote(rows.map((row) => row.company.id), latestCallNotes, lastActivitySort);
    const positions = new Map(ids.map((id, index) => [id, index]));
    return [...rows].sort((a, b) => positions.get(a.company.id)! - positions.get(b.company.id)!);
  }, [activeOpportunityFilter, companyRows, contactCompanyIds, contactFilter, countryFilter, exhibitionFilter, industryFilter, lastActivitySort, latestCallNotes, meetingFilter, nextActionFilter, productGroupFilter, statusFilter, viewMode]);
  const kanbanOpportunities = useMemo(() => {
    if (exhibitionFilter === "all") return [];
    const allowedCompanies = new Set(filteredRows.map((row) => row.company.id));
    const records = opportunities
      .filter((item) => item.exhibition_id === exhibitionFilter)
      .filter((item) => closedStageFilter === "active" ? !isTerminalBusinessStatus(item.stage) : item.stage === closedStageFilter)
      .filter((item) => allowedCompanies.has(item.company_id))
      .filter((item) => (closedStageFilter !== "active" || matchesNextAction(item, nextActionFilter)));
    const orderedCompanyIds = sortCompanyIdsByLastCallNote(
      records.map((item) => item.company_id),
      latestCallNotes,
      lastActivitySort,
    );
    const positions = new Map(orderedCompanyIds.map((id, index) => [id, index]));
    return [...records].sort(
      (first, second) =>
        (positions.get(first.company_id) ?? Number.MAX_SAFE_INTEGER) -
        (positions.get(second.company_id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [closedStageFilter, exhibitionFilter, filteredRows, lastActivitySort, latestCallNotes, nextActionFilter, opportunities]);

  function resetPrimaryFilters() { setExhibitionFilter("all"); setIndustryFilter("all"); setProductGroupFilter("all"); setStatusFilter("all"); }
  function clearSecondaryFilters() { setCountryFilter("all"); setNextActionFilter("all"); setActiveOpportunityFilter("all"); setContactFilter("all"); setMeetingFilter("all"); setClosedStageFilter("active"); }
  const secondaryFilterCount = [
    countryFilter !== "all", meetingFilter !== "all",
    viewMode === "list" && nextActionFilter !== "all",
    viewMode === "list" && activeOpportunityFilter !== "all",
    viewMode === "list" && contactFilter !== "all",
    viewMode === "kanban" && closedStageFilter === "active" && nextActionFilter !== "all",
    viewMode === "kanban" && closedStageFilter !== "active",
  ].filter(Boolean).length;
  function exportCsv() {
    const header = ["Firma", "Kişi", "E-posta", "Telefon", "Ülke", "Sektör", "Durum", "Aktif Fırsatlar", "Aşama", "Sonraki Aksiyon", "Sonraki Aksiyon Tarihi"];
    const rows = filteredRows.map(({ company, activeOpportunities, nextOpportunity, companyStatus }) => [company.company_name, company.contact_person ?? "", company.email ?? "", company.phone ?? "", company.country ?? "", company.industry ?? "", companyStatus, `${activeOpportunities.length} / ${MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY}`, getBusinessStatusLabel(nextOpportunity?.stage) ?? "", nextOpportunity?.next_action ?? "", nextOpportunity?.next_action_date ?? ""]);
    const blob = new Blob([[header, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "viawa-companies.csv"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  const filters = <section className="companies-filter-row" aria-label="Firma filtreleri">
    <label><span>Fuar</span><select value={exhibitionFilter} onChange={(e) => setExhibitionFilter(e.target.value)}><option value="all">Tüm Fuarlar</option>{exhibitions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label><span>Sektör</span><select value={industryFilter} onChange={(e) => setIndustryFilter(e.target.value)}><option value="all">Tüm Sektörler</option>{industries.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label><span>Ürün Grubu</span><select value={productGroupFilter} onChange={(e) => setProductGroupFilter(e.target.value)}><option value="all">Tüm Ürün Grupları</option>{productGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    {viewMode === "list" && <label><span>Durum</span><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}><option value="all">Tüm Durumlar</option>{COMPANY_STATUS_LABELS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>}
    <label><span>Son İşlem</span><select value={lastActivitySort} onChange={(e) => setLastActivitySort(e.target.value as LastActivitySort)}><option value="newest">En Yeni ↓</option><option value="oldest">En Eski ↑</option></select></label>
    <div className="companies-more-filter"><button className="btn" type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}>Daha Fazla Filtre{secondaryFilterCount ? ` · ${secondaryFilterCount}` : ""}</button>{moreOpen && <div className="companies-more-menu">
      <label><span>Ülke</span><select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)}><option value="all">Tümü</option>{countries.map((country) => <option key={country} value={country}>{country}</option>)}</select></label>
      {(viewMode === "list" || closedStageFilter === "active") && <label><span>Sonraki Aksiyon</span><select value={nextActionFilter} onChange={(e) => setNextActionFilter(e.target.value as NextActionFilter)}><option value="all">Tümü</option><option value="planned">Planlanmış</option><option value="unplanned">Planlanmamış</option><option value="overdue">Gecikmiş</option></select></label>}
      {viewMode === "list" && <label><span>Aktif Fırsat</span><select value={activeOpportunityFilter} onChange={(e) => setActiveOpportunityFilter(e.target.value as PresenceFilter)}><option value="all">Tümü</option><option value="yes">Var</option><option value="no">Yok</option></select></label>}
      {viewMode === "list" && <label><span>İletişim Kaydı</span><select value={contactFilter} onChange={(e) => setContactFilter(e.target.value as PresenceFilter)}><option value="all">Tümü</option><option value="yes">Var</option><option value="no">Yok</option></select></label>}
      <label><span>Görüşme Kaydı</span><select value={meetingFilter} onChange={(e) => setMeetingFilter(e.target.value as PresenceFilter)}><option value="all">Tümü</option><option value="yes">Var</option><option value="no">Yok</option></select></label>
      {viewMode === "kanban" && <label><span>Kapanan Fırsatlar</span><select value={closedStageFilter} onChange={(e) => { const value = e.target.value as ClosedStageFilter; setClosedStageFilter(value); if (value !== "active") setNextActionFilter("all"); }}><option value="active">Aktif Kanban</option><option value="signed">İmzalandı</option><option value="won">Kazanıldı</option><option value="lost">Kaybedildi</option></select></label>}
      <button type="button" onClick={clearSecondaryFilters}>Filtreleri Temizle</button>
    </div>}</div>
  </section>;

  return <main className="page companies-page">
    <TopbarSlot><section className="companies-operations" aria-label="Firma işlemleri">
      <div className="companies-total"><strong>{companies.length}</strong><span>Kayıtlı Firma</span></div>
      <Link className="btn btn-primary" to="/companies/new">+ Yeni Firma</Link><Link className="btn" to="/companies/import">Portföy İçe Aktar</Link>
      <button className="btn" type="button" onClick={exportCsv} disabled={!filteredRows.length}>CSV Dışa Aktar</button>
      <button className="btn" type="button" onClick={() => void load(true)} disabled={refreshing}>{refreshing ? "Yenileniyor..." : "Yenile"}</button>
      <div className="companies-view-switch" aria-label="Görünüm"><button type="button" className={viewMode === "kanban" ? "active" : ""} onClick={() => setViewMode("kanban")}>Kanban</button><button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>Liste</button></div>
    </section></TopbarSlot>
    {filters}
    <div className={`companies-results-area ${viewMode === "kanban" ? "is-kanban" : ""}`}>
      {loading && <Panel><p>Firmalar yükleniyor...</p></Panel>}
      {error && <Panel><p>{error}</p><button className="btn" type="button" onClick={() => void load()}>Tekrar Dene</button></Panel>}
      {!loading && !error && companies.length === 0 && <Panel className="companies-empty-state"><h2>Firma bulunamadı</h2><p className="muted">İlk firmayı oluşturun veya mevcut bir portföyü içe aktarın.</p><div className="companies-empty-actions"><Link className="btn btn-primary" to="/companies/new">+ Yeni Firma</Link><Link className="btn" to="/companies/import">Portföy İçe Aktar</Link></div></Panel>}
      {!loading && !error && companies.length > 0 && viewMode === "list" && filteredRows.length === 0 && <Panel className="companies-empty-state"><h2>Eşleşen firma yok</h2><p className="muted">Filtreleri değiştirerek daha fazla sonuç görüntüleyin.</p><button className="btn" type="button" onClick={() => { resetPrimaryFilters(); clearSecondaryFilters(); }}>Filtreleri Temizle</button></Panel>}
      {!loading && !error && viewMode === "list" && filteredRows.length > 0 && <section className="company-list">{filteredRows.map(({ company, activeOpportunities, nextOpportunity, companyStatus }) => <Panel key={company.id} className="company-row"><div className="company-row-main"><h2>{clean(company.company_name)}</h2><p>{clean(company.contact_person) || "Birincil kişi yok"}</p><span>{clean(company.email) || clean(company.phone) || "İletişim bilgisi yok"}</span></div><div><span>Sektör</span><strong>{clean(company.industry) || "Atanmadı"}</strong></div><div><span>Durum</span><strong>{companyStatus}</strong></div><div><span>Aktif Fırsatlar</span><strong>{activeOpportunities.length} / {MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY}</strong></div><div><span>Aşama</span><strong>{getBusinessStatusLabel(nextOpportunity?.stage) ?? "—"}</strong></div><div><span>Sonraki Aksiyon</span><strong>{nextOpportunity?.next_action ?? "Planlanmış aksiyon yok"}</strong><small>{formatDate(nextOpportunity?.next_action_date)}</small></div><Link className="btn btn-primary" to={`/companies/${company.id}`}>Firmayı Aç</Link></Panel>)}</section>}
      {!loading && !error && viewMode === "kanban" && exhibitionFilter === "all" && <Panel className="companies-empty-state"><h2>Bir fuar seçin</h2><p className="muted">Kanban, seçilen fuara ait gerçek fırsatları gösterir.</p></Panel>}
      {!loading && !error && viewMode === "kanban" && exhibitionFilter !== "all" && closedStageFilter === "active" && <KanbanBoard opportunities={kanbanOpportunities} companies={companiesById} contacts={contactsById} onOpen={(item) => navigate(buildWorkspacePath(item))} />}
      {!loading && !error && viewMode === "kanban" && exhibitionFilter !== "all" && closedStageFilter !== "active" && <ClosedOpportunityList opportunities={kanbanOpportunities} companies={companiesById} contacts={contactsById} exhibition={exhibitions.find((item) => item.id === exhibitionFilter)} onReturn={() => setClosedStageFilter("active")} onOpen={(item) => navigate(buildWorkspacePath(item))} />}
    </div>
  </main>;
}

function KanbanBoard({ opportunities, companies, contacts, onOpen }: { opportunities: Opportunity[]; companies: Map<string, Company>; contacts: Map<string, Contact>; onOpen: (opportunity: Opportunity) => void }) {
  const renderCard = (opportunity: Opportunity) => {
    const company = companies.get(opportunity.company_id);
    const contact = opportunity.contact_id ? contacts.get(opportunity.contact_id) : undefined;
    const overdue = Boolean(opportunity.next_action_date && new Date(opportunity.next_action_date).getTime() < Date.now());
    return <button type="button" className="companies-kanban-card" key={opportunity.id} onClick={() => onOpen(opportunity)}><div className="companies-kanban-card-title"><strong>{company?.company_name ?? "Bilinmeyen Firma"}</strong><span>{getBusinessStatusLabel(opportunity.stage) ?? "Durum Tanımsız"}</span></div><p>{getContactName(contact) || clean(company?.contact_person) || "İlgili kişi atanmadı"}</p><div className="companies-kanban-next"><span>{opportunity.next_action ?? "Planlanmış aksiyon yok"}</span><time className={overdue ? "overdue" : ""}>{formatDate(opportunity.next_action_date)}{overdue ? " · Gecikmiş" : ""}</time></div></button>;
  };
  return <section className="companies-kanban" aria-label="Fuar fırsat Kanbanı">{KANBAN_COLUMNS.map((column) => { const cards = opportunities.filter((item) => getKanbanColumnId(item.stage) === column.id); return <div className="companies-kanban-column" key={column.id}><header><h2>{column.label}</h2><span>{cards.length}</span></header><div className="companies-kanban-cards">{cards.map(renderCard)}{!cards.length && <p className="companies-kanban-empty">Bu aşamada fırsat yok.</p>}</div></div>; })}</section>;
}

function ClosedOpportunityList({ opportunities, companies, contacts, exhibition, onReturn, onOpen }: { opportunities: Opportunity[]; companies: Map<string, Company>; contacts: Map<string, Contact>; exhibition?: Exhibition; onReturn: () => void; onOpen: (opportunity: Opportunity) => void }) {
  return <section className="companies-closed-results"><header><div><h2>Kapanan Fırsatlar</h2><p>{exhibition?.name ?? "Seçili fuar"}</p></div><button className="btn" type="button" onClick={onReturn}>Aktif Kanbana Dön</button></header>{opportunities.length ? <div className="companies-closed-list">{opportunities.map((opportunity) => { const company = companies.get(opportunity.company_id); const contact = opportunity.contact_id ? contacts.get(opportunity.contact_id) : undefined; return <button type="button" key={opportunity.id} onClick={() => onOpen(opportunity)}><strong>{company?.company_name ?? "Bilinmeyen Firma"}</strong><span>{getBusinessStatusLabel(opportunity.stage)}</span><span>{exhibition?.name ?? "—"}</span><span>{getContactName(contact) || clean(company?.contact_person) || "İlgili kişi yok"}</span><span>{opportunity.closed_at ? formatDate(opportunity.closed_at) : "Kapanış tarihi yok"}</span><span>{opportunity.price_stand_area_sqm != null ? `${opportunity.price_stand_area_sqm} m²` : "Alan bilgisi yok"}</span></button>; })}</div> : <Panel className="companies-empty-state"><h2>Eşleşen kapanan fırsat yok</h2></Panel>}</section>;
}
