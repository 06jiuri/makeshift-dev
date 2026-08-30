type MetricField = string | number | boolean | null;

type ObserveOptions = {
  fields?: Record<string, MetricField>;
  slowMs?: number;
};

export async function observeServerOperation<T>(
  operation: string,
  run: () => Promise<T>,
  options: ObserveOptions = {},
): Promise<T> {
  const startedAt = performance.now();

  try {
    const result = await run();
    emitTiming(operation, startedAt, "ok", result, options);
    return result;
  } catch (error) {
    emitTiming(operation, startedAt, "error", null, options);
    throw error;
  }
}

function emitTiming<T>(
  operation: string,
  startedAt: number,
  outcome: "ok" | "error",
  result: T | null,
  { fields = {}, slowMs = 750 }: ObserveOptions,
) {
  const durationMs = Math.round(performance.now() - startedAt);
  const status = result instanceof Response ? result.status : undefined;

  console.info(
    JSON.stringify({
      event: "server_operation_timing",
      operation,
      outcome,
      durationMs,
      slow: durationMs >= slowMs,
      ...(status === undefined ? {} : { status }),
      ...fields,
    }),
  );
}
