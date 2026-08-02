import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  mergeDocxFile,
  mergeDocxBuffer,
} from "./docxMergeAdapter.ts";
import {
  readDocxPackage,
  readEntryData,
  replaceEntryData,
  writeDocxPackage,
} from "./docxPackage.ts";

function seedEntry(name, data) {
  return replaceEntryData(
    {
      name,
      compressedData: Buffer.alloc(0),
      compressionMethod: 0,
      crc32: 0,
      uncompressedSize: 0,
      flags: 0x0800,
      versionMadeBy: 20,
      versionNeeded: 20,
      modifiedTime: 0,
      modifiedDate: 0,
      internalAttributes: 0,
      externalAttributes: 0,
      localExtra: Buffer.alloc(0),
      centralExtra: Buffer.alloc(0),
      comment: Buffer.alloc(0),
    },
    Buffer.from(data),
  );
}

function textControl(tag, text = "placeholder") {
  return `<w:sdt><w:sdtPr><w:tag w:val="${tag}"/><w:text/></w:sdtPr><w:sdtContent><w:r><w:rPr><w:b/></w:rPr><w:t>${text}</w:t></w:r></w:sdtContent></w:sdt>`;
}

function checkboxControl(tag) {
  return `<w:sdt><w:sdtPr><w:tag w:val="${tag}"/><w14:checkbox><w14:checked w14:val="0"/></w14:checkbox></w:sdtPr><w:sdtContent><w:r><w:t>☐</w:t></w:r></w:sdtContent></w:sdt>`;
}

function templateXml(content) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"><w:body><w:p>${content}</w:p></w:body></w:document>`;
}

function fixture(content) {
  return writeDocxPackage([
    seedEntry(
      "[Content_Types].xml",
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    ),
    seedEntry("word/document.xml", templateXml(content)),
    seedEntry("word/media/unchanged.bin", Buffer.from([1, 2, 3, 4, 5])),
  ]);
}

function merge(templateBuffer, values, missingRequiredTags = []) {
  return mergeDocxBuffer({
    templateBuffer,
    mergeResult: {
      documentType: "test",
      templateFileName: "test.docx",
      values,
      missingRequiredTags,
    },
  });
}

function outputXml(buffer) {
  const entry = readDocxPackage(buffer).find(
    (candidate) => candidate.name === "word/document.xml",
  );
  assert.ok(entry);
  return readEntryData(entry).toString("utf8");
}

test("replaces single and repeated Content Controls by tag", () => {
  const result = merge(
    fixture(textControl("Company.Name") + textControl("Company.Name")),
    { "Company.Name": "VIAWA" },
  );

  assert.equal(result.totalContentControlOccurrencesUpdated, 2);
  assert.equal(result.tagsUpdated["Company.Name"], 2);
  assert.equal((outputXml(result.outputBuffer).match(/VIAWA/g) ?? []).length, 2);
});

test("preserves Turkish characters, XML escaping and multiline values", () => {
  const result = merge(fixture(textControl("Note")), {
    Note: "Çorlu & İstanbul\nİkinci <satır>",
  });
  const xml = outputXml(result.outputBuffer);

  assert.match(xml, /Çorlu &amp; İstanbul/);
  assert.match(xml, /<w:br\/>/);
  assert.match(xml, /İkinci &lt;satır&gt;/);
  assert.match(xml, /<w:rPr><w:b\/><\/w:rPr>/);
});

test("supports empty optional values without removing the Content Control", () => {
  const result = merge(fixture(textControl("Optional")), {
    Optional: undefined,
  });
  const xml = outputXml(result.outputBuffer);

  assert.match(xml, /<w:tag w:val="Optional"\/>/);
  assert.match(xml, /<w:t xml:space="preserve"><\/w:t>/);
});

test("reports mapped tags missing from DOCX and unmapped DOCX tags", () => {
  const result = merge(fixture(textControl("Only.In.Docx")), {
    "Only.In.Mapping": "value",
  });

  assert.deepEqual(result.mappedTagsMissingFromDocx, ["Only.In.Mapping"]);
  assert.deepEqual(result.unmappedTagsFoundInDocx, ["Only.In.Docx"]);
});

test("updates supported checkbox controls safely", () => {
  const result = merge(fixture(checkboxControl("Material.Table")), {
    "Material.Table": true,
  });
  const xml = outputXml(result.outputBuffer);

  assert.match(xml, /w14:checked w14:val="1"/);
  assert.match(xml, />☒<\/w:t>/);
  assert.deepEqual(result.unsupportedCheckboxTags, []);
});

test("rejects invalid DOCX input", () => {
  assert.throws(
    () => merge(Buffer.from("not a zip"), { Field: "value" }),
    /ZIP|DOCX/i,
  );
});

test("preserves unrelated ZIP entry bytes", () => {
  const input = fixture(textControl("Field"));
  const before = readDocxPackage(input).find(
    (entry) => entry.name === "word/media/unchanged.bin",
  );
  assert.ok(before);

  const result = merge(input, { Field: "updated" });
  const after = readDocxPackage(result.outputBuffer).find(
    (entry) => entry.name === "word/media/unchanged.bin",
  );
  assert.ok(after);

  assert.deepEqual(after.compressedData, before.compressedData);
  assert.deepEqual(readEntryData(after), readEntryData(before));
});

test("generates an openable DOCX from the active master without modifying it", async () => {
  const templatePath = path.resolve(
    "resources/templates/VIAWA_Sozlesme_Sablonu_v2.3_1_Doldurulabilir.docx",
  );
  const outputPath = path.join(
    tmpdir(),
    `viawa-docx-adapter-${randomUUID()}.docx`,
  );
  const before = await readFile(templatePath);
  const beforeHash = createHash("sha256").update(before).digest("hex");

  try {
    await mergeDocxFile({
      templatePath,
      outputPath,
      mergeResult: {
        documentType: "participation-contract",
        templateFileName: path.basename(templatePath),
        values: { "Company.LegalName": "VIAWA Test Company" },
        missingRequiredTags: [],
      },
    });
    const generated = await readFile(outputPath);
    assert.ok(generated.length > 0);
    assert.ok(readDocxPackage(generated).some((entry) => entry.name === "word/document.xml"));
    const after = await readFile(templatePath);
    assert.equal(createHash("sha256").update(after).digest("hex"), beforeHash);
  } finally {
    await rm(outputPath, { force: true });
  }
});
