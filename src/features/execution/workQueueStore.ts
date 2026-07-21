const workQueue: string[] = [];

export function addWorkQueueItem(item: string) {
  if (!workQueue.includes(item)) {
    workQueue.unshift(item);
  }
}

export function getWorkQueue() {
  return [...workQueue];
}

export function clearWorkQueue() {
  workQueue.length = 0;
}