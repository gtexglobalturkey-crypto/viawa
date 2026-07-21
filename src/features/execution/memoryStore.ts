import { MemoryEntry } from "./memoryBuilder";

const memory: MemoryEntry[] = [];

export function addMemoryEntry(entry: MemoryEntry) {
  const exists = memory.some(
    (item) =>
      item.title === entry.title &&
      item.description === entry.description &&
      item.eventType === entry.eventType
  );

  if (exists) {
    return;
  }

  memory.unshift(entry);
}

export function getMemory() {
  return [...memory];
}

export function clearMemory() {
  memory.length = 0;
}