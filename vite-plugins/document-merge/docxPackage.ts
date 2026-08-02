import { deflateRawSync, inflateRawSync } from "node:zlib";

const LOCAL_FILE_SIGNATURE = 0x04034b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;

export type DocxPackageEntry = {
  name: string;
  compressedData: Buffer;
  compressionMethod: number;
  crc32: number;
  uncompressedSize: number;
  flags: number;
  versionMadeBy: number;
  versionNeeded: number;
  modifiedTime: number;
  modifiedDate: number;
  internalAttributes: number;
  externalAttributes: number;
  localExtra: Buffer;
  centralExtra: Buffer;
  comment: Buffer;
};

export class InvalidDocxPackageError extends Error {}

function findEndRecord(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);

  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_SIGNATURE) {
      return offset;
    }
  }

  throw new InvalidDocxPackageError("DOCX ZIP end record was not found.");
}

export function readDocxPackage(buffer: Buffer): DocxPackageEntry[] {
  if (buffer.length < 22) {
    throw new InvalidDocxPackageError("DOCX file is too small to be a ZIP package.");
  }

  const endOffset = findEndRecord(buffer);
  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDisk = buffer.readUInt16LE(endOffset + 6);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);

  if (diskNumber !== 0 || centralDisk !== 0) {
    throw new InvalidDocxPackageError("Multi-disk DOCX ZIP packages are unsupported.");
  }

  const entries: DocxPackageEntry[] = [];
  let offset = centralOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_FILE_SIGNATURE) {
      throw new InvalidDocxPackageError("DOCX central directory is corrupted.");
    }

    const versionMadeBy = buffer.readUInt16LE(offset + 4);
    const versionNeeded = buffer.readUInt16LE(offset + 6);
    const flags = buffer.readUInt16LE(offset + 8);
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const modifiedTime = buffer.readUInt16LE(offset + 12);
    const modifiedDate = buffer.readUInt16LE(offset + 14);
    const crc32Value = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const internalAttributes = buffer.readUInt16LE(offset + 36);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localOffset = buffer.readUInt32LE(offset + 42);

    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localOffset === 0xffffffff
    ) {
      throw new InvalidDocxPackageError("ZIP64 DOCX packages are unsupported.");
    }

    const nameStart = offset + 46;
    const name = buffer
      .subarray(nameStart, nameStart + nameLength)
      .toString("utf8")
      .replace(/\\/g, "/");
    const centralExtra = Buffer.from(
      buffer.subarray(
        nameStart + nameLength,
        nameStart + nameLength + extraLength,
      ),
    );
    const comment = Buffer.from(
      buffer.subarray(
        nameStart + nameLength + extraLength,
        nameStart + nameLength + extraLength + commentLength,
      ),
    );

    if (buffer.readUInt32LE(localOffset) !== LOCAL_FILE_SIGNATURE) {
      throw new InvalidDocxPackageError(`Invalid local ZIP entry: ${name}`);
    }

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;

    entries.push({
      name,
      compressedData: Buffer.from(
        buffer.subarray(dataStart, dataStart + compressedSize),
      ),
      compressionMethod,
      crc32: crc32Value,
      uncompressedSize,
      flags,
      versionMadeBy,
      versionNeeded,
      modifiedTime,
      modifiedDate,
      internalAttributes,
      externalAttributes,
      localExtra: Buffer.from(
        buffer.subarray(
          localOffset + 30 + localNameLength,
          dataStart,
        ),
      ),
      centralExtra,
      comment,
    });

    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

export function readEntryData(entry: DocxPackageEntry): Buffer {
  if (entry.compressionMethod === 0) {
    return Buffer.from(entry.compressedData);
  }

  if (entry.compressionMethod === 8) {
    return inflateRawSync(entry.compressedData);
  }

  throw new InvalidDocxPackageError(
    `Unsupported ZIP compression method ${entry.compressionMethod} for ${entry.name}.`,
  );
}

const CRC_TABLE = Array.from({ length: 256 }, (_, tableIndex) => {
  let value = tableIndex;

  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }

  return value >>> 0;
});

function calculateCrc32(buffer: Buffer) {
  let value = 0xffffffff;

  for (const byte of buffer) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}

export function replaceEntryData(
  entry: DocxPackageEntry,
  data: Buffer,
): DocxPackageEntry {
  const compressionMethod = entry.compressionMethod === 0 ? 0 : 8;
  const compressedData =
    compressionMethod === 0 ? Buffer.from(data) : deflateRawSync(data);

  return {
    ...entry,
    compressedData,
    compressionMethod,
    crc32: calculateCrc32(data),
    uncompressedSize: data.length,
  };
}

export function writeDocxPackage(entries: readonly DocxPackageEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const flags = (entry.flags | 0x0800) & ~0x0008;
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(LOCAL_FILE_SIGNATURE, 0);
    localHeader.writeUInt16LE(entry.versionNeeded, 4);
    localHeader.writeUInt16LE(flags, 6);
    localHeader.writeUInt16LE(entry.compressionMethod, 8);
    localHeader.writeUInt16LE(entry.modifiedTime, 10);
    localHeader.writeUInt16LE(entry.modifiedDate, 12);
    localHeader.writeUInt32LE(entry.crc32, 14);
    localHeader.writeUInt32LE(entry.compressedData.length, 18);
    localHeader.writeUInt32LE(entry.uncompressedSize, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(entry.localExtra.length, 28);

    localParts.push(localHeader, name, entry.localExtra, entry.compressedData);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(CENTRAL_FILE_SIGNATURE, 0);
    centralHeader.writeUInt16LE(entry.versionMadeBy, 4);
    centralHeader.writeUInt16LE(entry.versionNeeded, 6);
    centralHeader.writeUInt16LE(flags, 8);
    centralHeader.writeUInt16LE(entry.compressionMethod, 10);
    centralHeader.writeUInt16LE(entry.modifiedTime, 12);
    centralHeader.writeUInt16LE(entry.modifiedDate, 14);
    centralHeader.writeUInt32LE(entry.crc32, 16);
    centralHeader.writeUInt32LE(entry.compressedData.length, 20);
    centralHeader.writeUInt32LE(entry.uncompressedSize, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(entry.centralExtra.length, 30);
    centralHeader.writeUInt16LE(entry.comment.length, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(entry.internalAttributes, 36);
    centralHeader.writeUInt32LE(entry.externalAttributes, 38);
    centralHeader.writeUInt32LE(localOffset, 42);

    centralParts.push(
      centralHeader,
      name,
      entry.centralExtra,
      entry.comment,
    );

    localOffset +=
      localHeader.length +
      name.length +
      entry.localExtra.length +
      entry.compressedData.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_SIGNATURE, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}
