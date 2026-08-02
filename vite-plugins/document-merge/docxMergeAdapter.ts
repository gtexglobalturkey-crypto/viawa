import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { TemplateMergeResult } from "../../src/modules/document-engine/merge/models";

import {
  InvalidDocxPackageError,
  readDocxPackage,
  readEntryData,
  replaceEntryData,
  writeDocxPackage,
} from "./docxPackage.ts";
import { mergeWordContentControls } from "./wordContentControls.ts";

const MERGEABLE_WORD_PART = /^word\/(?:document|header\d+|footer\d+)\.xml$/;

export type DocxMergeAdapterResult = {
  outputPath?: string;
  outputBuffer: Buffer;
  totalMappedFields: number;
  totalContentControlOccurrencesUpdated: number;
  tagsUpdated: Readonly<Record<string, number>>;
  mappedTagsMissingFromDocx: readonly string[];
  unmappedTagsFoundInDocx: readonly string[];
  unsupportedCheckboxTags: readonly string[];
  missingRequiredFields: readonly string[];
  warnings: readonly string[];
  errors: readonly string[];
  detectedContentControlCount: number;
};

export type MergeDocxOptions = {
  templateBuffer: Buffer;
  mergeResult: TemplateMergeResult;
};

export function mergeDocxBuffer({
  templateBuffer,
  mergeResult,
}: MergeDocxOptions): DocxMergeAdapterResult {
  if (
    !mergeResult ||
    typeof mergeResult.values !== "object" ||
    mergeResult.values === null
  ) {
    throw new Error("The resolved merge dictionary is invalid.");
  }

  const entries = readDocxPackage(templateBuffer);
  const entryNames = new Set(entries.map((entry) => entry.name));

  if (!entryNames.has("[Content_Types].xml") || !entryNames.has("word/document.xml")) {
    throw new InvalidDocxPackageError("The ZIP package is not a valid DOCX document.");
  }

  const detectedTags: string[] = [];
  const tagsUpdated: Record<string, number> = {};
  const unsupportedCheckboxTags = new Set<string>();
  const updatedEntries = entries.map((entry) => {
    if (!MERGEABLE_WORD_PART.test(entry.name)) {
      return entry;
    }

    const xml = readEntryData(entry).toString("utf8");
    const report = mergeWordContentControls(xml, mergeResult.values);
    detectedTags.push(...report.detectedTags);

    for (const [tag, count] of Object.entries(report.updatedTags)) {
      tagsUpdated[tag] = (tagsUpdated[tag] ?? 0) + count;
    }

    report.unsupportedCheckboxTags.forEach((tag) =>
      unsupportedCheckboxTags.add(tag),
    );

    return report.xml === xml
      ? entry
      : replaceEntryData(entry, Buffer.from(report.xml, "utf8"));
  });

  if (detectedTags.length === 0) {
    throw new Error("No usable Word Content Controls were found in the DOCX.");
  }

  const mappedTags = Object.keys(mergeResult.values);
  const detectedTagSet = new Set(detectedTags);
  const mappedTagSet = new Set(mappedTags);
  const mappedTagsMissingFromDocx = mappedTags
    .filter((tag) => !detectedTagSet.has(tag))
    .sort();
  const unmappedTagsFoundInDocx = [...detectedTagSet]
    .filter((tag) => !mappedTagSet.has(tag))
    .sort();
  const warnings: string[] = [];

  if (mappedTagsMissingFromDocx.length > 0) {
    warnings.push(
      `${mappedTagsMissingFromDocx.length} mapped tag(s) were not present in the DOCX.`,
    );
  }

  if (unmappedTagsFoundInDocx.length > 0) {
    warnings.push(
      `${unmappedTagsFoundInDocx.length} DOCX tag(s) had no mapping.`,
    );
  }

  if (unsupportedCheckboxTags.size > 0) {
    warnings.push(
      `${unsupportedCheckboxTags.size} checkbox tag(s) could not be updated safely.`,
    );
  }

  return {
    outputBuffer: writeDocxPackage(updatedEntries),
    totalMappedFields: mappedTags.length,
    totalContentControlOccurrencesUpdated: Object.values(tagsUpdated).reduce(
      (total, count) => total + count,
      0,
    ),
    tagsUpdated,
    mappedTagsMissingFromDocx,
    unmappedTagsFoundInDocx,
    unsupportedCheckboxTags: [...unsupportedCheckboxTags].sort(),
    missingRequiredFields: [...mergeResult.missingRequiredTags],
    warnings,
    errors: [],
    detectedContentControlCount: detectedTags.length,
  };
}

export async function mergeDocxFile(options: {
  templatePath: string;
  outputPath: string;
  mergeResult: TemplateMergeResult;
}): Promise<DocxMergeAdapterResult> {
  const templatePath = path.resolve(options.templatePath);
  const outputPath = path.resolve(options.outputPath);

  if (templatePath === outputPath) {
    throw new Error("The DOCX merge output must not overwrite the master template.");
  }

  let templateBuffer: Buffer;

  try {
    templateBuffer = await readFile(templatePath);
  } catch (error) {
    throw new Error(
      `Master DOCX template could not be read: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const result = mergeDocxBuffer({
    templateBuffer,
    mergeResult: options.mergeResult,
  });

  try {
    await writeFile(outputPath, result.outputBuffer, { flag: "wx" });
  } catch (error) {
    throw new Error(
      `Filled DOCX output could not be written: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return { ...result, outputPath };
}
