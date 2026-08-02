import {
  type ChangeEvent,
  type FocusEvent,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import { useToast } from "../../components/feedback/toastContext";
import {
  MasterListPicker,
  type MasterListPickerItem,
} from "../../components/ui/MasterListPicker";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";

import {
  formatCompanyName,
  formatCountry,
  formatEmail,
  formatPersonName,
  formatWebsite,
  splitPersonName,
} from "../../core/formatters/textFormatter";

import {
  createCompany,
  getCompany,
  updateCompany,
} from "../../services/supabase/companyService";

import {
  findDuplicateCompanyField,
  getDuplicateFieldMessage,
} from "../../core/validation/companyDuplicateCheck";

import {
  findDuplicateContactField,
  getContactConstraintErrorMessage,
  getContactDuplicateFieldMessage,
} from "../../core/validation/contactDuplicateCheck";

import {
  createContact,
  getContactsByCompany,
  updateContact,
} from "../../services/supabase/contactService";

import {
  createOpportunity,
} from "../../services/supabase/opportunityService";

import {
  createTimelineEvent,
} from "../../services/supabase/timelineService";

import {
  findOrCreateProductGroup,
  getCompanyProductGroups,
  replaceCompanyProductGroups,
  searchProductGroups,
} from "../../services/supabase/productGroupService";

import {
  findOrCreateSector,
  getCompanySectors,
  replaceCompanySectors,
  searchSectors,
} from "../../services/supabase/sectorService";

import type {
  Contact,
} from "../../types/database";

type CompanyFormState = {
  companyName: string;
  contactPerson: string;
  contactTitle: string;
  email: string;
  phone: string;
  contactIsPrimary: boolean;
  contactIsSignatory: boolean;
  website: string;
  country: string;
  status: string;

  taxOffice: string;
  taxNumber: string;
  postalCode: string;
  address: string;
  city: string;
  district: string;

  contact2Name: string;
  contact2Title: string;
  contact2Phone: string;
  contact2Email: string;
  contact2IsPrimary: boolean;
  contact2IsSignatory: boolean;
  contact3Name: string;
  contact3Title: string;
  contact3Phone: string;
  contact3Email: string;
  contact3IsPrimary: boolean;
  contact3IsSignatory: boolean;
  contact4Name: string;
  contact4Title: string;
  contact4Phone: string;
  contact4Email: string;
  contact4IsPrimary: boolean;
  contact4IsSignatory: boolean;
};

type StringFormField = {
  [Key in keyof CompanyFormState]: CompanyFormState[Key] extends string
    ? Key
    : never;
}[keyof CompanyFormState];

const initialFormState: CompanyFormState = {
  companyName: "",
  contactPerson: "",
  contactTitle: "",
  email: "",
  phone: "",
  contactIsPrimary: false,
  contactIsSignatory: false,
  website: "",
  country: "",
  status: "lead",

  taxOffice: "",
  taxNumber: "",
  postalCode: "",
  address: "",
  city: "",
  district: "",

  contact2Name: "",
  contact2Title: "",
  contact2Phone: "",
  contact2Email: "",
  contact2IsPrimary: false,
  contact2IsSignatory: false,
  contact3Name: "",
  contact3Title: "",
  contact3Phone: "",
  contact3Email: "",
  contact3IsPrimary: false,
  contact3IsSignatory: false,
  contact4Name: "",
  contact4Title: "",
  contact4Phone: "",
  contact4Email: "",
  contact4IsPrimary: false,
  contact4IsSignatory: false,
};

function getDefaultNextActionDate(): string {
  const date = new Date();

  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);

  return date.toISOString();
}

type PersonInput = {
  name: string;
  title: string;
  phone: string;
  email: string;
  isPrimaryContact: boolean;
  isSignatory: boolean;
};

function hasPersonData(
  person: PersonInput,
): boolean {
  return Boolean(
    person.name.trim() ||
      person.title.trim() ||
      person.phone.trim() ||
      person.email.trim(),
  );
}

/**
 * Creates/updates up to 4 real rows in the existing `contacts` table for
 * this company (max 4 contacts per company). Empty slots are skipped
 * entirely — never inserted. Form position (Kişi 1-4) is independent of
 * role now (a person can be primary, signatory, both, or neither), so
 * existing rows are matched to form slots purely by creation order —
 * whichever contact was created first is Kişi 1, and so on.
 */
async function saveContacts(
  companyId: string,
  people: PersonInput[],
  existingContacts: Contact[],
): Promise<void> {
  const orderedExisting = [
    ...existingContacts,
  ].sort(
    (first, second) =>
      new Date(
        first.created_at,
      ).getTime() -
      new Date(
        second.created_at,
      ).getTime(),
  );

  for (
    let index = 0;
    index < people.length;
    index += 1
  ) {
    const person = people[index];

    if (!hasPersonData(person)) {
      continue;
    }

    const { firstName, lastName } =
      splitPersonName(person.name);

    const payload = {
      company_id: companyId,
      first_name: firstName,
      last_name: lastName,
      title:
        person.title.trim() || null,
      phone:
        person.phone.trim() || null,
      email:
        formatEmail(person.email) ||
        null,
      is_primary:
        person.isPrimaryContact,
      is_signatory:
        person.isSignatory,
    };

    const matchedExisting =
      orderedExisting[index];

    if (matchedExisting) {
      await updateContact(
        matchedExisting.id,
        payload,
      );
    } else {
      await createContact(payload);
    }
  }
}

export function NewCompanyPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { id } = useParams();

  const isEditMode = Boolean(id);

  const [form, setForm] =
    useState<CompanyFormState>(
      initialFormState,
    );

  const [
    existingContacts,
    setExistingContacts,
  ] = useState<Contact[]>([]);

  const [
    selectedSectors,
    setSelectedSectors,
  ] = useState<MasterListPickerItem[]>(
    [],
  );

  const [
    selectedProductGroups,
    setSelectedProductGroups,
  ] = useState<MasterListPickerItem[]>(
    [],
  );

  const [
    isLoadingCompany,
    setIsLoadingCompany,
  ] = useState(isEditMode);

  const [
    loadErrorMessage,
    setLoadErrorMessage,
  ] = useState<string | null>(null);

  const [isSaving, setIsSaving] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    let isActive = true;

    setIsLoadingCompany(true);
    setLoadErrorMessage(null);

    Promise.all([
      getCompany(id),
      getContactsByCompany(id),
      getCompanySectors(id),
      getCompanyProductGroups(id),
    ])
      .then(
        ([
          company,
          contacts,
          companySectors,
          companyProductGroups,
        ]) => {
          if (!isActive) {
            return;
          }

          if (!company) {
            setLoadErrorMessage(
              "Firma kaydı bulunamadı.",
            );

            return;
          }

          setExistingContacts(
            contacts,
          );

          setSelectedSectors(
            companySectors.map(
              (sector) => ({
                id: sector.id,
                name: sector.name,
              }),
            ),
          );

          setSelectedProductGroups(
            companyProductGroups.map(
              (productGroup) => ({
                id: productGroup.id,
                name: productGroup.name,
              }),
            ),
          );

          const orderedContacts = [
            ...contacts,
          ].sort(
            (first, second) =>
              new Date(
                first.created_at,
              ).getTime() -
              new Date(
                second.created_at,
              ).getTime(),
          );

          const [
            firstContact,
            secondContact,
            thirdContact,
            fourthContact,
          ] = orderedContacts;

          const firstFullName =
            firstContact
              ? [
                  firstContact.first_name,
                  firstContact.last_name,
                ]
                  .filter(Boolean)
                  .join(" ")
              : "";

          setForm({
            companyName:
              company.company_name,
            contactPerson:
              firstFullName ||
              company.contact_person ||
              "",
            contactTitle:
              firstContact?.title ??
              "",
            email:
              firstContact?.email ??
              company.email ??
              "",
            phone:
              firstContact?.phone ??
              company.phone ??
              "",
            contactIsPrimary:
              firstContact?.is_primary ??
              false,
            contactIsSignatory:
              firstContact?.is_signatory ??
              false,
            website:
              company.website ?? "",
            country:
              company.country ?? "",
            status:
              company.status ||
              "lead",

            taxOffice:
              company.tax_office ??
              "",
            taxNumber:
              company.tax_number ??
              "",
            postalCode:
              company.postal_code ??
              "",
            address:
              company.address ?? "",
            city: company.city ?? "",
            district:
              company.district ??
              "",

            contact2Name:
              [
                secondContact?.first_name,
                secondContact?.last_name,
              ]
                .filter(Boolean)
                .join(" "),
            contact2Title:
              secondContact?.title ??
              "",
            contact2Phone:
              secondContact?.phone ??
              "",
            contact2Email:
              secondContact?.email ??
              "",
            contact2IsPrimary:
              secondContact?.is_primary ??
              false,
            contact2IsSignatory:
              secondContact?.is_signatory ??
              false,

            contact3Name:
              [
                thirdContact?.first_name,
                thirdContact?.last_name,
              ]
                .filter(Boolean)
                .join(" "),
            contact3Title:
              thirdContact?.title ??
              "",
            contact3Phone:
              thirdContact?.phone ??
              "",
            contact3Email:
              thirdContact?.email ??
              "",
            contact3IsPrimary:
              thirdContact?.is_primary ??
              false,
            contact3IsSignatory:
              thirdContact?.is_signatory ??
              false,

            contact4Name:
              [
                fourthContact?.first_name,
                fourthContact?.last_name,
              ]
                .filter(Boolean)
                .join(" "),
            contact4Title:
              fourthContact?.title ??
              "",
            contact4Phone:
              fourthContact?.phone ??
              "",
            contact4Email:
              fourthContact?.email ??
              "",
            contact4IsPrimary:
              fourthContact?.is_primary ??
              false,
            contact4IsSignatory:
              fourthContact?.is_signatory ??
              false,
          });
        },
      )
      .catch((loadError) => {
        console.error(
          "Company load error:",
          loadError,
        );

        if (isActive) {
          setLoadErrorMessage(
            "Firma bilgileri yüklenemedi.",
          );
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingCompany(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [id]);

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement
    >,
  ) {
    const {
      name,
      value,
    } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleCheckboxChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const {
      name,
      checked,
    } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: checked,
    }));
  }

  const fieldFormatters: Partial<
    Record<
      StringFormField,
      (value: string) => string
    >
  > = {
    companyName: formatCompanyName,
    contactPerson: formatPersonName,
    email: formatEmail,
    website: formatWebsite,
    country: formatCountry,
    contact2Name: formatPersonName,
    contact2Email: formatEmail,
    contact3Name: formatPersonName,
    contact3Email: formatEmail,
    contact4Name: formatPersonName,
    contact4Email: formatEmail,
  };

  function handleBlur(
    event: FocusEvent<HTMLInputElement>,
  ) {
    const name = event.target
      .name as StringFormField;

    const formatter = fieldFormatters[name];

    if (!formatter) {
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      [name]: formatter(
        currentForm[name],
      ),
    }));
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const companyName = formatCompanyName(
      form.companyName,
    );

    if (!companyName) {
      setErrorMessage(
        "Firma adı zorunludur.",
      );

      return;
    }

    const companyPayload = {
      company_name: companyName,
      contact_person:
        formatPersonName(
          form.contactPerson,
        ) || null,
      email:
        formatEmail(form.email) ||
        null,
      phone:
        form.phone.trim() || null,
      website:
        formatWebsite(
          form.website,
        ) || null,
      country:
        formatCountry(
          form.country,
        ) || null,
      // Position-1 sector is the canonical primary sector — kept in
      // sync here for backward compatibility (see
      // supabase/migrations/20260728_add_sectors_and_product_groups.sql).
      // replaceCompanySectors below re-derives the same value at the
      // database level once the RPC runs, so this is never the only
      // place industry gets set, just the earliest.
      industry:
        selectedSectors[0]?.name ?? null,
      status:
        form.status.trim() ||
        "lead",

      tax_office:
        form.taxOffice.trim() ||
        null,
      tax_number:
        form.taxNumber.trim() ||
        null,
      postal_code:
        form.postalCode.trim() ||
        null,
      address:
        form.address.trim() ||
        null,
      city: form.city.trim() || null,
      district:
        form.district.trim() ||
        null,
    };

    const people: PersonInput[] = [
      {
        name: form.contactPerson,
        title: form.contactTitle,
        phone: form.phone,
        email: form.email,
        isPrimaryContact:
          form.contactIsPrimary,
        isSignatory:
          form.contactIsSignatory,
      },
      {
        name: form.contact2Name,
        title: form.contact2Title,
        phone: form.contact2Phone,
        email: form.contact2Email,
        isPrimaryContact:
          form.contact2IsPrimary,
        isSignatory:
          form.contact2IsSignatory,
      },
      {
        name: form.contact3Name,
        title: form.contact3Title,
        phone: form.contact3Phone,
        email: form.contact3Email,
        isPrimaryContact:
          form.contact3IsPrimary,
        isSignatory:
          form.contact3IsSignatory,
      },
      {
        name: form.contact4Name,
        title: form.contact4Title,
        phone: form.contact4Phone,
        email: form.contact4Email,
        isPrimaryContact:
          form.contact4IsPrimary,
        isSignatory:
          form.contact4IsSignatory,
      },
    ];

    // Same position-matching the actual save uses (saveContacts), so each
    // person here is compared for duplicates against everyone else EXCEPT
    // their own existing contact row.
    const orderedExistingContactsForCheck =
      [...existingContacts].sort(
        (first, second) =>
          new Date(
            first.created_at,
          ).getTime() -
          new Date(
            second.created_at,
          ).getTime(),
      );

    const peopleForContactDuplicateCheck =
      people.map((person, index) => ({
        email: person.email,
        phone: person.phone,
        excludeContactId:
          orderedExistingContactsForCheck[
            index
          ]?.id ?? null,
      }));

    let savedCompanyId: string | null =
      null;

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const duplicateField =
        await findDuplicateCompanyField(
          {
            companyName:
              companyPayload.company_name,
            phone: companyPayload.phone,
            email: companyPayload.email,
            taxNumber:
              companyPayload.tax_number,
            website:
              companyPayload.website,
            address:
              companyPayload.address,
          },
          isEditMode ? id : undefined,
        );

      if (duplicateField) {
        setErrorMessage(
          getDuplicateFieldMessage(
            duplicateField,
          ),
        );

        return;
      }

      const duplicateContactField =
        await findDuplicateContactField(
          peopleForContactDuplicateCheck,
        );

      if (duplicateContactField) {
        setErrorMessage(
          getContactDuplicateFieldMessage(
            duplicateContactField,
          ),
        );

        return;
      }

      if (isEditMode && id) {
        await updateCompany(
          id,
          companyPayload,
        );

        savedCompanyId = id;
      } else {
        const company =
          await createCompany(
            companyPayload,
          );

        savedCompanyId = company.id;

        try {
          await createTimelineEvent({
            company_id: company.id,
            opportunity_id: null,
            type: "company-created",
            title:
              "Firma oluşturuldu",
            description: `${companyName} firma kaydı oluşturuldu.`,
          });
        } catch (timelineError) {
          console.error(
            "Company timeline creation error:",
            timelineError,
          );
        }

        try {
          const opportunity =
            await createOpportunity(
              {
                company_id:
                  company.id,
                exhibition_id: null,
                stage: "new",
                interest_level: 25,
                estimated_value: 0,
                next_action:
                  "Initial sales call",
                next_action_date:
                  getDefaultNextActionDate(),
                owner: null,
              },
            );

          try {
            await createTimelineEvent(
              {
                company_id:
                  company.id,
                opportunity_id:
                  opportunity.id,
                type: "opportunity-created",
                title:
                  "Katılım fırsatı oluşturuldu",
                description: `${companyName} için yeni bir katılım fırsatı oluşturuldu.`,
              },
            );
          } catch (timelineError) {
            console.error(
              "Opportunity timeline creation error:",
              timelineError,
            );
          }
        } catch (opportunityError) {
          console.error(
            "Opportunity creation error:",
            opportunityError,
          );

          showToast(
            "Firma oluşturuldu ancak katılım fırsatı oluşturulamadı.",
            "error",
          );
        }
      }

      let contactsFailed = false;
      let contactsErrorMessage:
        | string
        | null = null;

      try {
        await saveContacts(
          savedCompanyId,
          people,
          existingContacts,
        );
      } catch (contactError) {
        console.error(
          "Contact save error:",
          contactError,
        );

        contactsFailed = true;
        contactsErrorMessage =
          getContactConstraintErrorMessage(
            contactError,
          );
      }

      if (contactsFailed) {
        showToast(
          contactsErrorMessage ??
            (isEditMode
              ? "Firma bilgileri güncellendi ancak kişi bilgileri kaydedilemedi."
              : "Firma oluşturuldu ancak kişi bilgileri kaydedilemedi."),
          "error",
        );
      }

      try {
        await replaceCompanySectors(
          savedCompanyId,
          selectedSectors.map(
            (sector) => sector.id,
          ),
        );

        await replaceCompanyProductGroups(
          savedCompanyId,
          selectedProductGroups.map(
            (productGroup) =>
              productGroup.id,
          ),
        );
      } catch (
        sectorOrProductGroupError
      ) {
        console.error(
          "Sector/product group sync error:",
          sectorOrProductGroupError,
        );

        showToast(
          "Firma kaydedildi ancak sektör/ürün grubu bilgileri kaydedilemedi.",
          "error",
        );
      }

      if (!contactsFailed) {
        showToast(
          isEditMode
            ? "Firma ve kişi bilgileri güncellendi."
            : "Firma ve kişi bilgileri kaydedildi.",
          "success",
        );
      }

      navigate(
        `/companies/${encodeURIComponent(
          savedCompanyId,
        )}`,
        {
          replace: !isEditMode,
        },
      );
    } catch (error) {
      console.error(
        "Company could not be saved:",
        error,
      );

      setErrorMessage(
        isEditMode
          ? "Firma bilgileri güncellenemedi."
          : "Firma kaydedilemedi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const cancelHref =
    isEditMode && id
      ? `/companies/${encodeURIComponent(
          id,
        )}`
      : "/companies";

  if (isLoadingCompany) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Firmalar"
          title="Firma/Kişi Kayıt Alanı"
          subtitle="Firma bilgileri yükleniyor..."
        />

        <Panel>
          <p className="muted">
            Lütfen bekleyin.
          </p>
        </Panel>
      </main>
    );
  }

  if (loadErrorMessage) {
    return (
      <main className="page">
        <PageHeader
          eyebrow="Firmalar"
          title="Firma/Kişi Kayıt Alanı"
          subtitle={loadErrorMessage}
        />

        <Link
          className="btn btn-primary"
          to="/companies"
        >
          Firmalara Dön
        </Link>
      </main>
    );
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Firmalar"
        title="Firma/Kişi Kayıt Alanı"
        subtitle={
          isEditMode
            ? "Firma ve kişi bilgilerini güncelleyin."
            : "Firmayı ve kişileri kaydedin. Firma Kaydı sayfası ardından açılır."
        }
      />

      <Panel>
        <form
          onSubmit={handleSubmit}
          className="company-form"
        >
          <p className="eyebrow">
            Firma Bilgileri
          </p>

          <div className="form-grid">
            <label>
              <span>Firma Adı *</span>

              <input
                name="companyName"
                value={form.companyName}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Firma adı"
                autoFocus={!isEditMode}
                disabled={isSaving}
                required
              />
            </label>

            <label>
              <span>Web Sitesi</span>

              <input
                name="website"
                value={form.website}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="https://..."
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Ülke</span>

              <input
                name="country"
                value={form.country}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Türkiye"
                disabled={isSaving}
              />
            </label>

            <div className="form-field-fill">
              <MasterListPicker
                label="Sektörler"
                addNewLabel="Yeni Sektör Ekle"
                placeholder="Sektör ara veya ekle..."
                primaryLabel="Birincil Sektör"
                selected={selectedSectors}
                onChange={
                  setSelectedSectors
                }
                onSearch={searchSectors}
                onCreate={
                  findOrCreateSector
                }
                disabled={isSaving}
              />
            </div>

            <div className="form-field-fill">
              <MasterListPicker
                label="Ürün Grupları"
                addNewLabel="Yeni Ürün Grubu Ekle"
                placeholder="Ürün grubu ara veya ekle..."
                selected={
                  selectedProductGroups
                }
                onChange={
                  setSelectedProductGroups
                }
                onSearch={
                  searchProductGroups
                }
                onCreate={
                  findOrCreateProductGroup
                }
                disabled={isSaving}
              />
            </div>

            <label>
              <span>Durum</span>

              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={isSaving}
              >
                <option value="lead">
                  Aday
                </option>

                <option value="prospect">
                  Potansiyel
                </option>

                <option value="customer">
                  Müşteri
                </option>

                <option value="inactive">
                  Pasif
                </option>
              </select>
            </label>
          </div>

          <p className="eyebrow">
            Kaşe Bilgileri
          </p>

          <div className="form-grid">
            <label>
              <span>Vergi Dairesi</span>

              <input
                name="taxOffice"
                value={form.taxOffice}
                onChange={handleChange}
                placeholder="Vergi dairesi"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Vergi Numarası</span>

              <input
                name="taxNumber"
                value={form.taxNumber}
                onChange={handleChange}
                placeholder="Vergi numarası"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Posta Kodu</span>

              <input
                name="postalCode"
                value={form.postalCode}
                onChange={handleChange}
                placeholder="Posta kodu"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Şehir</span>

              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Şehir"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>İlçe</span>

              <input
                name="district"
                value={form.district}
                onChange={handleChange}
                placeholder="İlçe"
                disabled={isSaving}
              />
            </label>

            <label className="form-field-fill">
              <span>Adres</span>

              <input
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Açık adres"
                disabled={isSaving}
              />
            </label>
          </div>

          <p className="eyebrow">
            Kişi 1
          </p>

          <div className="form-grid">
            <label>
              <span>Ad Soyad</span>

              <input
                name="contactPerson"
                value={
                  form.contactPerson
                }
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="İletişim kişisi"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Ünvan</span>

              <input
                name="contactTitle"
                value={
                  form.contactTitle
                }
                onChange={handleChange}
                placeholder="Görev / ünvan"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Telefon</span>

              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+90..."
                disabled={isSaving}
              />
            </label>

            <label>
              <span>E-posta</span>

              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="contact@company.com"
                disabled={isSaving}
              />
            </label>

            <label className="form-field-fill form-role-checkboxes">
              <input
                type="checkbox"
                name="contactIsPrimary"
                checked={
                  form.contactIsPrimary
                }
                onChange={
                  handleCheckboxChange
                }
                disabled={isSaving}
              />
              <span>
                Fuar Yetkilisi / Ana
                İletişim Kişisi
              </span>
            </label>

            <label className="form-field-fill form-role-checkboxes">
              <input
                type="checkbox"
                name="contactIsSignatory"
                checked={
                  form.contactIsSignatory
                }
                onChange={
                  handleCheckboxChange
                }
                disabled={isSaving}
              />
              <span>İmza Yetkilisi</span>
            </label>
          </div>

          <p className="eyebrow">
            Kişi 2
          </p>

          <div className="form-grid">
            <label>
              <span>Ad Soyad</span>

              <input
                name="contact2Name"
                value={
                  form.contact2Name
                }
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="İletişim kişisi"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Ünvan</span>

              <input
                name="contact2Title"
                value={
                  form.contact2Title
                }
                onChange={handleChange}
                placeholder="Görev / ünvan"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Telefon</span>

              <input
                name="contact2Phone"
                value={
                  form.contact2Phone
                }
                onChange={handleChange}
                placeholder="+90..."
                disabled={isSaving}
              />
            </label>

            <label>
              <span>E-posta</span>

              <input
                name="contact2Email"
                type="email"
                value={
                  form.contact2Email
                }
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="contact@company.com"
                disabled={isSaving}
              />
            </label>

            <label className="form-field-fill form-role-checkboxes">
              <input
                type="checkbox"
                name="contact2IsPrimary"
                checked={
                  form.contact2IsPrimary
                }
                onChange={
                  handleCheckboxChange
                }
                disabled={isSaving}
              />
              <span>
                Fuar Yetkilisi / Ana
                İletişim Kişisi
              </span>
            </label>

            <label className="form-field-fill form-role-checkboxes">
              <input
                type="checkbox"
                name="contact2IsSignatory"
                checked={
                  form.contact2IsSignatory
                }
                onChange={
                  handleCheckboxChange
                }
                disabled={isSaving}
              />
              <span>İmza Yetkilisi</span>
            </label>
          </div>

          <p className="eyebrow">
            Kişi 3
          </p>

          <div className="form-grid">
            <label>
              <span>Ad Soyad</span>

              <input
                name="contact3Name"
                value={
                  form.contact3Name
                }
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="İletişim kişisi"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Ünvan</span>

              <input
                name="contact3Title"
                value={
                  form.contact3Title
                }
                onChange={handleChange}
                placeholder="Görev / ünvan"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Telefon</span>

              <input
                name="contact3Phone"
                value={
                  form.contact3Phone
                }
                onChange={handleChange}
                placeholder="+90..."
                disabled={isSaving}
              />
            </label>

            <label>
              <span>E-posta</span>

              <input
                name="contact3Email"
                type="email"
                value={
                  form.contact3Email
                }
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="contact@company.com"
                disabled={isSaving}
              />
            </label>

            <label className="form-field-fill form-role-checkboxes">
              <input
                type="checkbox"
                name="contact3IsPrimary"
                checked={
                  form.contact3IsPrimary
                }
                onChange={
                  handleCheckboxChange
                }
                disabled={isSaving}
              />
              <span>
                Fuar Yetkilisi / Ana
                İletişim Kişisi
              </span>
            </label>

            <label className="form-field-fill form-role-checkboxes">
              <input
                type="checkbox"
                name="contact3IsSignatory"
                checked={
                  form.contact3IsSignatory
                }
                onChange={
                  handleCheckboxChange
                }
                disabled={isSaving}
              />
              <span>İmza Yetkilisi</span>
            </label>
          </div>

          <p className="eyebrow">
            Kişi 4
          </p>

          <div className="form-grid">
            <label>
              <span>Ad Soyad</span>

              <input
                name="contact4Name"
                value={
                  form.contact4Name
                }
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="İletişim kişisi"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Ünvan</span>

              <input
                name="contact4Title"
                value={
                  form.contact4Title
                }
                onChange={handleChange}
                placeholder="Görev / ünvan"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Telefon</span>

              <input
                name="contact4Phone"
                value={
                  form.contact4Phone
                }
                onChange={handleChange}
                placeholder="+90..."
                disabled={isSaving}
              />
            </label>

            <label>
              <span>E-posta</span>

              <input
                name="contact4Email"
                type="email"
                value={
                  form.contact4Email
                }
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="contact@company.com"
                disabled={isSaving}
              />
            </label>

            <label className="form-field-fill form-role-checkboxes">
              <input
                type="checkbox"
                name="contact4IsPrimary"
                checked={
                  form.contact4IsPrimary
                }
                onChange={
                  handleCheckboxChange
                }
                disabled={isSaving}
              />
              <span>
                Fuar Yetkilisi / Ana
                İletişim Kişisi
              </span>
            </label>

            <label className="form-field-fill form-role-checkboxes">
              <input
                type="checkbox"
                name="contact4IsSignatory"
                checked={
                  form.contact4IsSignatory
                }
                onChange={
                  handleCheckboxChange
                }
                disabled={isSaving}
              />
              <span>İmza Yetkilisi</span>
            </label>
          </div>

          {errorMessage ? (
            <p
              className="form-error"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="form-actions">
            <Link
              className="btn"
              to={cancelHref}
              aria-disabled={isSaving}
            >
              İptal
            </Link>

            <button
              className="btn btn-primary"
              type="submit"
              disabled={isSaving}
            >
              {isSaving
                ? "Kaydediliyor..."
                : "Firma/Kişi Ekle/Güncelle"}
            </button>
          </div>
        </form>
      </Panel>
    </main>
  );
}
