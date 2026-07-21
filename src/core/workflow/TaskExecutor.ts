import type {
  WorkflowCompletionResult,
  WorkflowState,
  WorkflowTask,
} from "./workflowTypes";

export class TaskExecutor {
  async execute(
    task: WorkflowTask,
    state: WorkflowState,
  ): Promise<WorkflowCompletionResult> {
    const remainingQueue =
      state.queue.filter(
        (queueTask) =>
          queueTask.id !== task.id,
      );

    const nextTask =
      remainingQueue[0] ?? null;

    return {
      completedTask: task,
      nextTask,
      state: {
        ...state,
        currentTask: nextTask,
        queue: remainingQueue,
      },
    };
  }
}