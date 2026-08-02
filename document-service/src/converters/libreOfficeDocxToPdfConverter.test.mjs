import assert from "node:assert/strict";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

const { createLibreOfficeDocxToPdfConverter } = await import(
  new URL("./libreOfficeDocxToPdfConverter.ts", import.meta.url)
);
const { convertDocxToPdf } = await import(
  new URL("../../../vite-plugins/document-pdf/docxToPdfConverterPort.ts", import.meta.url)
);

async function fixture(t, runner, dependencies = {}) {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "viawa-lo-test-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));
  return {
    tempRoot,
    converter: createLibreOfficeDocxToPdfConverter(
      { binaryPath: "controlled-libreoffice", tempRoot, defaultTimeoutMs: 1234 },
      { runProcess: runner, ...dependencies },
    ),
  };
}

function expectedPaths(args) {
  const outdirIndex = args.indexOf("--outdir");
  assert.notEqual(outdirIndex, -1);
  const outputDirectory = args[outdirIndex + 1];
  const inputPath = args.at(-1);
  return {
    inputPath,
    outputPath: path.join(outputDirectory, "document.pdf"),
    conversionRoot: path.dirname(path.dirname(inputPath)),
    profileArgument: args.find((arg) => arg.startsWith("-env:UserInstallation=")),
  };
}

test("writes a fixed DOCX name and invokes the safe execFile boundary", async (t) => {
  const original = Buffer.from("CONFIDENTIAL-DOCX");
  const before = Buffer.from(original);
  let call;
  const setup = await fixture(t, async (binary, args, options) => {
    call = { binary, args, options };
    const paths = expectedPaths(args);
    assert.equal(path.basename(paths.inputPath), "document.docx");
    assert.equal(await readFile(paths.inputPath, "utf8"), original.toString());
    await writeFile(paths.outputPath, Buffer.from("%PDF-1.7 mock"));
  });
  const pdf = await convertDocxToPdf(setup.converter, original, { timeoutMs: 5000 });
  assert.equal(pdf.toString(), "%PDF-1.7 mock");
  assert.deepEqual(original, before);
  assert.equal(call.binary, "controlled-libreoffice");
  assert.equal(call.options.shell, false);
  assert.equal(call.options.timeout, 5000);
  assert.deepEqual(call.args.slice(0, 5), [
    "--headless", "--nologo", "--nodefault", "--nolockcheck", "--nofirststartwizard",
  ]);
  assert.match(expectedPaths(call.args).profileArgument, /^-env:UserInstallation=file:/);
  await assert.rejects(access(expectedPaths(call.args).conversionRoot));
});

test("uses unique conversion and profile directories concurrently", async (t) => {
  const roots = new Set();
  const profiles = new Set();
  const setup = await fixture(t, async (_binary, args) => {
    const paths = expectedPaths(args);
    roots.add(paths.conversionRoot);
    profiles.add(paths.profileArgument);
    await writeFile(paths.outputPath, Buffer.from("%PDF-mock"));
  });
  await Promise.all([
    convertDocxToPdf(setup.converter, Buffer.from("DOCX-A")),
    convertDocxToPdf(setup.converter, Buffer.from("DOCX-B")),
  ]);
  assert.equal(roots.size, 2);
  assert.equal(profiles.size, 2);
});

test("cleans temporary files after process failure", async (t) => {
  let conversionRoot;
  const setup = await fixture(t, async (_binary, args) => {
    conversionRoot = expectedPaths(args).conversionRoot;
    throw new Error("raw stderr CONFIDENTIAL-DOCX");
  });
  await assert.rejects(
    () => convertDocxToPdf(setup.converter, Buffer.from("CONFIDENTIAL-DOCX")),
    (error) => error.code === "CONVERSION_FAILED" && !error.message.includes("CONFIDENTIAL"),
  );
  await assert.rejects(access(conversionRoot));
});

test("maps timeout, binary-not-found and non-zero exit", async (t) => {
  const scenarios = [
    { code: "ETIMEDOUT", expected: "TIMEOUT" },
    { code: "ENOENT", expected: "CONVERSION_FAILED" },
    { code: 1, expected: "CONVERSION_FAILED" },
  ];
  for (const scenario of scenarios) {
    const setup = await fixture(t, async () => {
      const error = new Error("raw stdout and stderr");
      error.code = scenario.code;
      throw error;
    });
    await assert.rejects(
      () => convertDocxToPdf(setup.converter, Buffer.from("DOCX")),
      (error) => error.code === scenario.expected && !error.message.includes("stdout"),
    );
  }
});

test("rejects missing, empty and invalid expected PDF output", async (t) => {
  const cases = [
    { write: false, output: null, code: "CONVERSION_FAILED" },
    { write: true, output: Buffer.alloc(0), code: "EMPTY_PDF_OUTPUT" },
    { write: true, output: Buffer.from("not-pdf"), code: "INVALID_PDF_OUTPUT" },
  ];
  for (const scenario of cases) {
    const setup = await fixture(t, async (_binary, args) => {
      if (scenario.write) await writeFile(expectedPaths(args).outputPath, scenario.output);
    });
    await assert.rejects(
      () => convertDocxToPdf(setup.converter, Buffer.from("DOCX")),
      (error) => error.code === scenario.code,
    );
  }
});

test("cleanup failure does not mask the primary failure", async (t) => {
  const setup = await fixture(
    t,
    async () => { throw new Error("primary failure"); },
    { removeDirectory: async () => { throw new Error("cleanup failure"); } },
  );
  await assert.rejects(
    () => convertDocxToPdf(setup.converter, Buffer.from("DOCX")),
    (error) => error.code === "CONVERSION_FAILED",
  );
});
