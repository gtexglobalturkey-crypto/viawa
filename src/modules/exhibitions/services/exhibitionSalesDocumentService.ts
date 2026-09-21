import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getDriveFileViewUrl,
  type ExhibitionSalesDocument,
} from "../models/ExhibitionSalesDocument";

const COLUMNS = "id,exhibition_id,document_type,title,drive_file_id,sort_order";

export async function loadExhibitionSalesDocuments(
  client: SupabaseClient,
  exhibitionId: string,
): Promise<ExhibitionSalesDocument[]> {
  if (!exhibitionId.trim()) return [];

  const { data, error } = await client
    .from("exhibition_sales_documents")
    .select(COLUMNS)
    .eq("exhibition_id", exhibitionId)
    .order("sort_order", { ascending: true })
    .order("title", { ascending: true });

  if (error) throw error;

  return (data ?? []).flatMap((row): ExhibitionSalesDocument[] => {
    if (
      typeof row.id !== "string" ||
      !row.id ||
      row.exhibition_id !== exhibitionId ||
      typeof row.document_type !== "string" ||
      !/^[a-z][a-z0-9_]{0,63}$/.test(row.document_type) ||
      typeof row.title !== "string" ||
      !row.title.trim() ||
      row.title.trim().length > 120 ||
      typeof row.drive_file_id !== "string" ||
      !getDriveFileViewUrl(row.drive_file_id) ||
      !Number.isInteger(row.sort_order) ||
      row.sort_order < 0
    ) {
      return [];
    }

    return [{
      id: row.id,
      exhibitionId: row.exhibition_id,
      documentType: row.document_type,
      title: row.title.trim(),
      driveFileId: row.drive_file_id,
      sortOrder: row.sort_order,
    }];
  });
}
