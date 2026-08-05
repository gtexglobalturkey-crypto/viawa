export function serializeErrorForLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const errorWithExtras = error as Error & { code?: string; cause?: unknown };
    const serialized: Record<string, unknown> = {
      errorName: error.name,
      errorMessage: error.message,
    };

    if (errorWithExtras.code !== undefined) serialized.errorCode = errorWithExtras.code;
    if (error.stack) serialized.errorStack = error.stack;

    const cause = errorWithExtras.cause;

    if (cause instanceof Error) {
      serialized.causeName = cause.name;
      serialized.causeMessage = cause.message;
      if (cause.stack) serialized.causeStack = cause.stack;
    } else if (cause !== undefined) {
      serialized.cause = String(cause);
    }

    return serialized;
  }

  return { errorValue: String(error) };
}
