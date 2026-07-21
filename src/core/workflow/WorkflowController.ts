import { TaskExecutor } from "./TaskExecutor";

import type {
  WorkflowCompletionResult,
  WorkflowState,
  WorkflowTask,
} from "./workflowTypes";

export class WorkflowController {
  private readonly taskExecutor: TaskExecutor;

  constructor(
    taskExecutor: TaskExecutor = new TaskExecutor(),
  ) {
    this.taskExecutor = taskExecutor;
  }

  async completeTask(
    task: WorkflowTask,
    state: WorkflowState,
  ): Promise<WorkflowCompletionResult> {
    return this.taskExecutor.execute(
      task,
      state,
    );
  }
}