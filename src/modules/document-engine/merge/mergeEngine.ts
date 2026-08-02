import type {
  TemplateFieldValue,
  TemplateMappingDefinition,
  TemplateMergeResult,
} from "./models";

function hasMergeValue(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== null && value !== undefined;
}

/**
 * Resolves business data into a tag/value dictionary. It deliberately
 * does not open or mutate DOCX files; a later adapter can consume this
 * result for Word, quotation or invitation-letter templates.
 */
export function resolveTemplateMerge<Context>(
  definition: TemplateMappingDefinition<Context>,
  context: Context,
): TemplateMergeResult {
  const values: Record<
    string,
    TemplateFieldValue
  > = {};
  const missingRequiredTags: string[] = [];

  for (const field of definition.fields) {
    if (
      Object.prototype.hasOwnProperty.call(
        values,
        field.tag,
      )
    ) {
      throw new Error(
        `Duplicate template field mapping: ${field.tag}`,
      );
    }

    const value = field.resolve(context);
    values[field.tag] = value;

    if (field.required && !hasMergeValue(value)) {
      missingRequiredTags.push(field.tag);
    }
  }

  return {
    documentType: definition.documentType,
    templateFileName: definition.templateFileName,
    values,
    missingRequiredTags,
  };
}
