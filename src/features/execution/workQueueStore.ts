export type WorkQueueItem = {
  id: string;
  title: string;
  companyId?: string;
};

let nextItemId = 0;

const workQueue: WorkQueueItem[] = [];

export function addWorkQueueItem(
  title: string,
  companyId?: string,
) {
  const alreadyQueued = workQueue.some(
    (item) =>
      item.title === title &&
      item.companyId === companyId,
  );

  if (alreadyQueued) {
    return;
  }

  workQueue.unshift({
    id: `work-queue-${nextItemId++}`,
    title,
    companyId,
  });
}

export function getWorkQueue(
  companyId?: string,
): WorkQueueItem[] {
  if (!companyId) {
    return [];
  }

  return workQueue.filter(
    (item) => item.companyId === companyId,
  );
}

export function clearWorkQueue() {
  workQueue.length = 0;
}
