import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { TopbarSlot } from "../../components/layout/topbarSlotContext";
import { Panel } from "../../components/ui/Panel";
import { COMPANY_PAGE_SIZE, getCompaniesByIds, getCompanyDirectoryOptions, getCompanyDirectoryPage, type Company, type CompanyDirectoryRow, type CommunicationFilter } from "../../services/supabase/companyService";
import { getContactsByIds, type Contact } from "../../services/supabase/contactService";
import { getExhibitions, type Exhibition } from "../../services/supabase/exhibitionService";
import { getOpportunitiesByExhibition, type Opportunity } from "../../services/supabase/opportunityService";
import { listSectors, type Sector } from "../../services/supabase/sectorService";
import { listProductGroups, type ProductGroup } from "../../services/supabase/productGroupService";
import { COMPANY_STATUS_LABELS, getBusinessStatusLabel, isTerminalBusinessStatus, MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY } from "../../types/businessStatus";
import { buildWorkspacePath, getKanbanColumnId, KANBAN_COLUMNS } from "./models/companiesKanban";

type ViewMode = "list" | "kanban";
const formatDate = (value?: string | null) => { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(date); };
const contactName = (contact?: Contact) => contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ") : "";

export function CompaniesPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [productGroupId, setProductGroupId] = useState("");
  const [communication, setCommunication] = useState<CommunicationFilter>("all");
  const [exhibitionId, setExhibitionId] = useState("");
  const [status, setStatus] = useState<"" | CompanyDirectoryRow["companyStatus"]>("");
  const [closedStage, setClosedStage] = useState<"active" | "signed" | "won" | "lost">("active");
  const [moreOpen, setMoreOpen] = useState(false);
  const [rows, setRows] = useState<CompanyDirectoryRow[]>([]);
  const [total, setTotal] = useState(0);
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
  const [countries, setCountries] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [kanbanCompanies, setKanbanCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void Promise.all([getExhibitions(), listSectors(), listProductGroups()]).then(([fairs, sectorRows, products]) => { setExhibitions(fairs); setSectors(sectorRows); setProductGroups(products); }).catch(() => setError("Filtre seçenekleri yüklenemedi.")); }, []);
  useEffect(() => { void getCompanyDirectoryOptions(country || undefined).then((options) => { setCountries(options.countries); setCities(options.cities); if (city && !options.cities.includes(city)) setCity(""); }).catch(() => setError("Ülke/şehir seçenekleri yüklenemedi.")); }, [city, country]);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300); return () => window.clearTimeout(timer); }, [searchInput]);
  useEffect(() => { setPage(1); }, [search, country, city, sectorId, productGroupId, communication, exhibitionId, status]);

  const loadList = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const result = await getCompanyDirectoryPage({ page, search, country: country || undefined, city: city || undefined, sectorId: sectorId || undefined, productGroupId: productGroupId || undefined, communication, exhibitionId: exhibitionId || undefined, status: status || undefined });
      setRows(result.rows); setTotal(result.total);
    } catch (loadError) { console.error(loadError); setError("Firma listesi yüklenemedi."); }
    finally { setLoading(false); }
  }, [city, communication, country, exhibitionId, page, productGroupId, search, sectorId, status]);

  const loadKanban = useCallback(async () => {
    if (!exhibitionId) { setOpportunities([]); setKanbanCompanies([]); setContacts([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const fairOpportunities = await getOpportunitiesByExhibition(exhibitionId);
      const [companies, people] = await Promise.all([
        getCompaniesByIds([...new Set(fairOpportunities.map((item) => item.company_id))]),
        getContactsByIds([...new Set(fairOpportunities.map((item) => item.contact_id).filter((id): id is string => Boolean(id)))]),
      ]);
      setOpportunities(fairOpportunities); setKanbanCompanies(companies); setContacts(people);
    } catch (loadError) { console.error(loadError); setError("Fuar Kanbanı yüklenemedi."); }
    finally { setLoading(false); }
  }, [exhibitionId]);

  useEffect(() => { void (viewMode === "list" ? loadList() : loadKanban()); }, [loadKanban, loadList, viewMode]);
  const pageCount = Math.max(1, Math.ceil(total / COMPANY_PAGE_SIZE));
  const companiesById = useMemo(() => new Map(kanbanCompanies.map((item) => [item.id, item])), [kanbanCompanies]);
  const contactsById = useMemo(() => new Map(contacts.map((item) => [item.id, item])), [contacts]);
  const activeKanban = opportunities.filter((item) => !isTerminalBusinessStatus(item.stage));
  const visibleKanban = closedStage === "active" ? activeKanban : opportunities.filter((item) => item.stage === closedStage);
  function exportCurrentPage() {
    const values = [["Firma", "E-posta", "Telefon", "Ülke", "Şehir", "Sektör", "Durum"], ...rows.map((row) => [row.company.company_name, row.company.email ?? "", row.company.phone ?? "", row.company.country ?? "", row.company.city ?? "", row.company.industry ?? "", row.companyStatus])];
    const csv = values.map((record) => record.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `viawa-companies-page-${page}.csv`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <main className="page companies-page">
    <TopbarSlot><section className="companies-operations" aria-label="Firma işlemleri"><div className="companies-total"><strong>{(viewMode === "list" ? total : visibleKanban.length).toLocaleString("tr-TR")}</strong><span>{viewMode === "list" ? "Eşleşen Firma" : "Fuar Fırsatı"}</span></div><Link className="btn btn-primary" to="/companies/new">+ Yeni Firma</Link><Link className="btn" to="/companies/import">Portföy İçe Aktar</Link>{viewMode === "list" && <button className="btn" type="button" disabled={!rows.length} onClick={exportCurrentPage}>CSV Dışa Aktar</button>}<button className="btn" type="button" onClick={() => void (viewMode === "list" ? loadList() : loadKanban())}>Yenile</button><div className="companies-view-switch" aria-label="Görünüm"><button type="button" className={viewMode === "kanban" ? "active" : ""} onClick={() => setViewMode("kanban")}>Kanban</button><button type="button" className={viewMode === "list" ? "active" : ""} onClick={() => setViewMode("list")}>Liste</button></div></section></TopbarSlot>
    <section className="companies-filter-row" aria-label="Firma filtreleri">
      <label className="companies-search"><span>Ara</span><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Firma, e-posta, telefon, web, şehir veya ülke" /></label>
      <label><span>Sektör</span><select value={sectorId} onChange={(e) => setSectorId(e.target.value)}><option value="">Tüm Sektörler</option>{sectors.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label><span>Ülke</span><select value={country} onChange={(e) => setCountry(e.target.value)}><option value="">Tüm Ülkeler</option>{countries.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>Şehir</span><select value={city} onChange={(e) => setCity(e.target.value)}><option value="">Tüm Şehirler</option>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label><span>İletişim</span><select value={communication} onChange={(e) => setCommunication(e.target.value as CommunicationFilter)}><option value="all">Tümü</option><option value="email">E-posta var</option><option value="phone">Telefon var</option><option value="either">E-posta veya telefon var</option><option value="both">E-posta ve telefon var</option><option value="none">İletişim bilgisi yok</option></select></label>
      <div className="companies-more-filter"><button className="btn" type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((value) => !value)}>Daha Fazla Filtre</button>{moreOpen && <div className="companies-more-menu"><label><span>Ürün Grubu</span><select value={productGroupId} onChange={(e) => setProductGroupId(e.target.value)}><option value="">Tüm Ürün Grupları</option>{productGroups.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Fuar</span><select value={exhibitionId} onChange={(e) => setExhibitionId(e.target.value)}><option value="">Tüm Fuarlar</option>{exhibitions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{viewMode === "list" && <label><span>Durum</span><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="">Tüm Durumlar</option>{COMPANY_STATUS_LABELS.map((item) => <option key={item}>{item}</option>)}</select></label>}{viewMode === "kanban" && <label><span>Kapanan Fırsatlar</span><select value={closedStage} onChange={(e) => setClosedStage(e.target.value as typeof closedStage)}><option value="active">Aktif Kanban</option><option value="signed">İmzalandı</option><option value="won">Kazanıldı</option><option value="lost">Kaybedildi</option></select></label>}</div>}</div>
    </section>
    <div className={`companies-results-area ${viewMode === "kanban" ? "is-kanban" : ""}`}>
      {loading && <Panel><p>Firmalar yükleniyor...</p></Panel>}{error && <Panel><p>{error}</p><button className="btn" type="button" onClick={() => void (viewMode === "list" ? loadList() : loadKanban())}>Tekrar Dene</button></Panel>}
      {!loading && !error && viewMode === "list" && !rows.length && <Panel className="companies-empty-state"><h2>Eşleşen firma yok</h2><p className="muted">Filtreleri değiştirin veya yeni bir firma ekleyin.</p><div className="companies-empty-actions"><Link className="btn btn-primary" to="/companies/new">+ Yeni Firma</Link><Link className="btn" to="/companies/import">Portföy İçe Aktar</Link></div></Panel>}
      {!loading && !error && viewMode === "list" && rows.length > 0 && <><section className="company-list">{rows.map(({ company, activeOpportunityCount, nextOpportunity, companyStatus }) => <Panel key={company.id} className="company-row"><div className="company-row-main"><h2>{company.company_name}</h2><p>{company.contact_person || "Birincil kişi yok"}</p><span>{company.email || company.phone || "İletişim bilgisi yok"}</span></div><div><span>Sektör</span><strong>{company.industry || "Atanmadı"}</strong></div><div><span>Durum</span><strong>{companyStatus}</strong></div><div><span>Aktif Fırsatlar</span><strong>{activeOpportunityCount} / {MAX_ACTIVE_OPPORTUNITIES_PER_COMPANY}</strong></div><div><span>Aşama</span><strong>{getBusinessStatusLabel(nextOpportunity?.stage) ?? "—"}</strong></div><div><span>Sonraki Aksiyon</span><strong>{nextOpportunity?.next_action ?? "Planlanmış aksiyon yok"}</strong><small>{formatDate(nextOpportunity?.next_action_date)}</small></div><Link className="btn btn-primary" to={`/companies/${company.id}`}>Firmayı Aç</Link></Panel>)}</section><nav className="companies-pagination"><button className="btn" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Önceki</button><span>Sayfa {page} / {pageCount} · {total.toLocaleString("tr-TR")} sonuç</span><button className="btn" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Sonraki</button></nav></>}
      {!loading && !error && viewMode === "kanban" && !exhibitionId && <Panel className="companies-empty-state"><h2>Bir fuar seçin</h2><p>Kanban yalnız seçilen fuara ait gerçek fırsatları gösterir.</p></Panel>}
      {!loading && !error && viewMode === "kanban" && exhibitionId && closedStage === "active" && <KanbanBoard opportunities={visibleKanban} companies={companiesById} contacts={contactsById} onOpen={(item) => navigate(buildWorkspacePath(item))} />}
      {!loading && !error && viewMode === "kanban" && exhibitionId && closedStage !== "active" && <ClosedOpportunityList opportunities={visibleKanban} companies={companiesById} contacts={contactsById} exhibition={exhibitions.find((item) => item.id === exhibitionId)} onReturn={() => setClosedStage("active")} onOpen={(item) => navigate(buildWorkspacePath(item))} />}
    </div>
  </main>;
}

function ClosedOpportunityList({ opportunities, companies, contacts, exhibition, onReturn, onOpen }: { opportunities: Opportunity[]; companies: Map<string, Company>; contacts: Map<string, Contact>; exhibition?: Exhibition; onReturn: () => void; onOpen: (item: Opportunity) => void }) {
  return <section className="companies-closed-results"><header><div><h2>Kapanan Fırsatlar</h2><p>{exhibition?.name ?? "Seçili fuar"}</p></div><button className="btn" type="button" onClick={onReturn}>Aktif Kanbana Dön</button></header>{opportunities.length ? <div className="companies-closed-list">{opportunities.map((item) => { const company = companies.get(item.company_id); const contact = item.contact_id ? contacts.get(item.contact_id) : undefined; return <button type="button" key={item.id} onClick={() => onOpen(item)}><strong>{company?.company_name ?? "Bilinmeyen Firma"}</strong><span>{getBusinessStatusLabel(item.stage)}</span><span>{exhibition?.name ?? "—"}</span><span>{contactName(contact) || company?.contact_person || "İlgili kişi yok"}</span><span>{item.closed_at ? formatDate(item.closed_at) : "Kapanış tarihi yok"}</span><span>{item.price_stand_area_sqm != null ? `${item.price_stand_area_sqm} m²` : "Alan bilgisi yok"}</span></button>; })}</div> : <Panel className="companies-empty-state"><h2>Eşleşen kapanan fırsat yok</h2></Panel>}</section>;
}

function KanbanBoard({ opportunities, companies, contacts, onOpen }: { opportunities: Opportunity[]; companies: Map<string, Company>; contacts: Map<string, Contact>; onOpen: (item: Opportunity) => void }) {
  return <section className="companies-kanban" aria-label="Fuar fırsat Kanbanı">{KANBAN_COLUMNS.map((column) => { const cards = opportunities.filter((item) => getKanbanColumnId(item.stage) === column.id); return <div className="companies-kanban-column" key={column.id}><header><h2>{column.label}</h2><span>{cards.length}</span></header><div className="companies-kanban-cards">{cards.map((item) => { const company = companies.get(item.company_id); const contact = item.contact_id ? contacts.get(item.contact_id) : undefined; const overdue = Boolean(item.next_action_date && new Date(item.next_action_date).getTime() < Date.now()); return <button type="button" className="companies-kanban-card" key={item.id} onClick={() => onOpen(item)}><div className="companies-kanban-card-title"><strong>{company?.company_name ?? "Bilinmeyen Firma"}</strong><span>{getBusinessStatusLabel(item.stage)}</span></div><p>{contactName(contact) || company?.contact_person || "İlgili kişi atanmadı"}</p><div className="companies-kanban-next"><span>{item.next_action ?? "Planlanmış aksiyon yok"}</span><time className={overdue ? "overdue" : ""}>{formatDate(item.next_action_date)}{overdue ? " · Gecikmiş" : ""}</time></div></button>; })}{!cards.length && <p className="companies-kanban-empty">Bu aşamada fırsat yok.</p>}</div></div>; })}</section>;
}
