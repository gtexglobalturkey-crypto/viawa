import {
  type ChangeEvent,
  type FormEvent,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";

import { useToast } from "../../components/feedback/toastContext";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";

import {
  createCompany,
} from "../../services/supabase/companyService";

import {
  createOpportunity,
} from "../../services/supabase/opportunityService";

import {
  createTimelineEvent,
} from "../../services/supabase/timelineService";

type CompanyFormState = {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  industry: string;
  status: string;
};

const initialFormState: CompanyFormState = {
  companyName: "",
  contactPerson: "",
  email: "",
  phone: "",
  website: "",
  country: "",
  industry: "",
  status: "lead",
};

function getDefaultNextActionDate(): string {
  const date = new Date();

  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);

  return date.toISOString();
}

export function NewCompanyPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [form, setForm] =
    useState<CompanyFormState>(
      initialFormState,
    );

  const [isSaving, setIsSaving] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(null);

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

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (isSaving) {
      return;
    }

    const companyName =
      form.companyName.trim();

    if (!companyName) {
      setErrorMessage(
        "Firma adı zorunludur.",
      );

      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const company =
        await createCompany({
          company_name: companyName,
          contact_person:
            form.contactPerson.trim() ||
            null,
          email:
            form.email.trim() || null,
          phone:
            form.phone.trim() || null,
          website:
            form.website.trim() || null,
          country:
            form.country.trim() || null,
          industry:
            form.industry.trim() || null,
          status:
            form.status.trim() ||
            "lead",
        });

      try {
        await createTimelineEvent({
          company_id: company.id,
          opportunity_id: null,
          type: "company-created",
          title: "Firma oluşturuldu",
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
          await createOpportunity({
            company_id: company.id,
            exhibition_id: null,
            stage: "new",
            interest_level: 25,
            estimated_value: 0,
            next_action:
              "Initial sales call",
            next_action_date:
              getDefaultNextActionDate(),
            owner: null,
          });

        try {
          await createTimelineEvent({
            company_id: company.id,
            opportunity_id:
              opportunity.id,
            type: "opportunity-created",
            title:
              "Katılım fırsatı oluşturuldu",
            description: `${companyName} için yeni bir katılım fırsatı oluşturuldu.`,
          });
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

      navigate(
        `/companies/${encodeURIComponent(
          company.id,
        )}`,
        {
          replace: true,
        },
      );
    } catch (error) {
      console.error(
        "Company and opportunity could not be created:",
        error,
      );

      setErrorMessage(
        "Firma veya katılım fırsatı kaydedilemedi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Firmalar"
        title="Yeni Firma"
        subtitle="Firmayı oluşturun, Firma Detayı sayfası açılsın. Satış görüşmesini istediğinizde ayrıca başlatabilirsiniz."
      />

      <Panel>
        <form
          onSubmit={handleSubmit}
          className="company-form"
        >
          <div className="form-grid">
            <label>
              <span>Firma Adı *</span>

              <input
                name="companyName"
                value={form.companyName}
                onChange={handleChange}
                placeholder="Firma adı"
                autoFocus
                disabled={isSaving}
                required
              />
            </label>

            <label>
              <span>Birincil Kişi</span>

              <input
                name="contactPerson"
                value={form.contactPerson}
                onChange={handleChange}
                placeholder="İletişim kişisi"
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
                placeholder="contact@company.com"
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
              <span>Web Sitesi</span>

              <input
                name="website"
                value={form.website}
                onChange={handleChange}
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
                placeholder="Türkiye"
                disabled={isSaving}
              />
            </label>

            <label>
              <span>Sektör</span>

              <input
                name="industry"
                value={form.industry}
                onChange={handleChange}
                placeholder="Madencilik"
                disabled={isSaving}
              />
            </label>

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
              to="/companies"
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
                ? "Oluşturuluyor..."
                : "Firmayı Oluştur"}
            </button>
          </div>
        </form>
      </Panel>
    </main>
  );
}