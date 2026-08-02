export type MergePrimitive = string | number | boolean | null | undefined;

export type ContentControlMergeReport = {
  xml: string;
  detectedTags: readonly string[];
  updatedTags: Readonly<Record<string, number>>;
  unsupportedCheckboxTags: readonly string[];
};

const SDT_TOKEN = /<w:sdt(?=[\s>])|<\/w:sdt>/g;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXmlAttribute(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function assertPlausibleXml(xml: string) {
  if (!/^\s*<\?xml[\s\S]*<w:/.test(xml) || !xml.includes("</w:")) {
    throw new Error("Word XML part is corrupted or unreadable.");
  }

  const openings = (xml.match(/<w:sdt(?=[\s>])/g) ?? []).length;
  const closings = (xml.match(/<\/w:sdt>/g) ?? []).length;

  if (openings !== closings) {
    throw new Error("Word XML contains unbalanced Content Controls.");
  }
}

function findOutermostSdtRanges(xml: string) {
  const ranges: Array<{ start: number; end: number }> = [];
  let depth = 0;
  let start = -1;

  for (const match of xml.matchAll(SDT_TOKEN)) {
    if (match[0].startsWith("</")) {
      depth -= 1;

      if (depth === 0 && start >= 0) {
        ranges.push({ start, end: match.index + match[0].length });
        start = -1;
      }
    } else {
      if (depth === 0) {
        start = match.index;
      }

      depth += 1;
    }
  }

  return ranges;
}

function getTag(block: string) {
  const properties = block.match(/<w:sdtPr\b[\s\S]*?<\/w:sdtPr>/)?.[0];
  const tag = properties?.match(/<w:tag\b[^>]*\bw:val="([^"]*)"[^>]*\/?\s*>/)?.[1];
  return tag ? decodeXmlAttribute(tag) : null;
}

function buildRunContent(existingContent: string, value: string) {
  const runProperties = existingContent.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/)?.[0] ?? "";
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const runs: string[] = [];

  lines.forEach((line, index) => {
    if (index > 0) {
      runs.push(`<w:r>${runProperties}<w:br/></w:r>`);
    }

    runs.push(
      `<w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`,
    );
  });

  return runs.join("");
}

function updateTextControl(block: string, value: string) {
  return block.replace(
    /(<w:sdtContent\b[^>]*>)[\s\S]*?(<\/w:sdtContent>)/,
    (_match, opening: string, closing: string) => {
      const original = _match.slice(opening.length, -closing.length);
      return `${opening}${buildRunContent(original, value)}${closing}`;
    },
  );
}

function updateCheckbox(block: string, checked: boolean) {
  if (!/<w14:checkbox\b/.test(block) || !/<w14:checked\b[^>]*w14:val="[^"]*"/.test(block)) {
    return null;
  }

  const checkedValue = checked ? "1" : "0";
  const glyph = checked ? "☒" : "☐";

  return block
    .replace(
      /(<w14:checked\b[^>]*w14:val=")[^"]*(")/,
      `$1${checkedValue}$2`,
    )
    .replace(
      /(<w:sdtContent\b[^>]*>[\s\S]*?<w:t\b[^>]*>)[\s\S]*?(<\/w:t>[\s\S]*?<\/w:sdtContent>)/,
      `$1${glyph}$2`,
    );
}

export function mergeWordContentControls(
  xml: string,
  values: Readonly<Record<string, MergePrimitive>>,
): ContentControlMergeReport {
  assertPlausibleXml(xml);

  const detectedTags: string[] = [];
  const updatedTags: Record<string, number> = {};
  const unsupportedCheckboxTags = new Set<string>();
  let output = xml;
  const ranges = findOutermostSdtRanges(xml).reverse();

  for (const range of ranges) {
    const originalBlock = xml.slice(range.start, range.end);
    const tag = getTag(originalBlock);

    if (!tag) {
      continue;
    }

    detectedTags.push(tag);

    if (!Object.prototype.hasOwnProperty.call(values, tag)) {
      continue;
    }

    const value = values[tag];
    const isCheckbox = /<w14:checkbox\b/.test(originalBlock);
    let updatedBlock: string | null;

    if (isCheckbox) {
      updatedBlock =
        typeof value === "boolean" ? updateCheckbox(originalBlock, value) : null;

      if (!updatedBlock) {
        unsupportedCheckboxTags.add(tag);
        continue;
      }
    } else {
      updatedBlock = updateTextControl(
        originalBlock,
        value === null || value === undefined ? "" : String(value),
      );
    }

    updatedTags[tag] = (updatedTags[tag] ?? 0) + 1;

    if (updatedBlock !== originalBlock) {
      output = output.slice(0, range.start) + updatedBlock + output.slice(range.end);
    }
  }

  return {
    xml: output,
    detectedTags,
    updatedTags,
    unsupportedCheckboxTags: [...unsupportedCheckboxTags].sort(),
  };
}
