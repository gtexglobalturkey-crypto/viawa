import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  buildOrganizerReportSnapshot,
  ORGANIZER_REPORT_SCHEMA_VERSION,
} from "../_shared/organizerReport.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = request.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authorization.startsWith("Bearer ") || !supabaseUrl || !serviceKey) {
      return json({ error: "Yetkisiz istek." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const token = authorization.slice("Bearer ".length);
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return json({ error: "Oturum doğrulanamadı." }, 401);

    const { data: member } = await admin
      .from("application_users")
      .select("id,is_active")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (!member?.is_active) return json({ error: "VIAWA erişimi bulunamadı." }, 403);

    const body = await request.json() as Record<string, unknown>;
    const exhibitionId = typeof body.exhibitionId === "string" ? body.exhibitionId : "";
    const periodStart = body.periodStart == null || body.periodStart === "" ? null : body.periodStart;
    const periodEnd = body.periodEnd == null || body.periodEnd === "" ? null : body.periodEnd;
    const periodLabel = typeof body.periodLabel === "string" && body.periodLabel.trim()
      ? body.periodLabel.trim().slice(0, 120)
      : null;
    if (!exhibitionId || (periodStart !== null && !validDate(periodStart)) || (periodEnd !== null && !validDate(periodEnd))) {
      return json({ error: "Rapor parametreleri geçersiz." }, 400);
    }
    if (periodStart && periodEnd && periodStart > periodEnd) {
      return json({ error: "Rapor başlangıç tarihi bitiş tarihinden sonra olamaz." }, 400);
    }

    const cutoff = new Date().toISOString();
    const [{ data: exhibition, error: exhibitionError }, { data: opportunities, error: opportunityError }] =
      await Promise.all([
        admin.from("exhibitions").select("id,name").eq("id", exhibitionId).maybeSingle(),
        admin.from("opportunities")
          .select("id,company_id,exhibition_id,stage,updated_at")
          .eq("exhibition_id", exhibitionId)
          .lte("updated_at", cutoff),
      ]);
    if (exhibitionError || !exhibition) return json({ error: "Fuar bulunamadı." }, 404);
    if (opportunityError) throw opportunityError;

    const companyIds = [...new Set((opportunities ?? []).map((item) => item.company_id))];
    const opportunityIds = (opportunities ?? []).map((item) => item.id);
    const [{ data: companies, error: companyError }, { data: approvedSnapshots, error: snapshotError }] =
      await Promise.all([
        companyIds.length
          ? admin.from("companies").select("id,company_name").in("id", companyIds)
          : Promise.resolve({ data: [], error: null }),
        opportunityIds.length
          ? admin.from("approved_price_snapshots")
              .select("opportunity_id,approved_at,created_at,price_input")
              .eq("exhibition_id", exhibitionId)
              .in("opportunity_id", opportunityIds)
              .lte("approved_at", cutoff)
              .lte("created_at", cutoff)
          : Promise.resolve({ data: [], error: null }),
      ]);
    if (companyError) throw companyError;
    if (snapshotError) throw snapshotError;

    const snapshot = buildOrganizerReportSnapshot({
      exhibitionId,
      exhibitionName: exhibition.name,
      opportunities: opportunities ?? [],
      companies: companies ?? [],
      approvedSnapshots: approvedSnapshots ?? [],
    });
    const generatedAt = new Date().toISOString();
    const reportId = `VIAWA-OR-${generatedAt.slice(0, 10).replaceAll("-", "")}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const { data: saved, error: insertError } = await admin
      .from("organizer_report_snapshots")
      .insert({
        report_id: reportId,
        exhibition_id: exhibitionId,
        period_start: periodStart,
        period_end: periodEnd,
        period_label: periodLabel,
        data_cutoff: cutoff,
        generated_at: generatedAt,
        schema_version: ORGANIZER_REPORT_SCHEMA_VERSION,
        snapshot,
        created_by: authData.user.id,
      })
      .select("id,report_id,exhibition_id,period_start,period_end,period_label,data_cutoff,generated_at,schema_version,snapshot,created_at")
      .single();
    if (insertError) throw insertError;
    return json({ report: saved }, 201);
  } catch (error) {
    console.error("Organizer Report generation failed", error);
    const message = error instanceof Error ? error.message : "Rapor oluşturulamadı.";
    return json({ error: message }, 422);
  }
});
