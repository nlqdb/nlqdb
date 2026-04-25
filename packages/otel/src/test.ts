// Test helpers — keep production bundle free of in-memory exporters.

import {
  AggregationTemporality,
  InMemoryMetricExporter,
  PeriodicExportingMetricReader,
} from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import {
  installTelemetryForTest,
  resetInstrumentsForTest,
  resetTelemetryForTest,
  type TelemetryHandle,
} from "./index.ts";

export type TestTelemetry = {
  handle: TelemetryHandle;
  spanExporter: InMemorySpanExporter;
  metricExporter: InMemoryMetricExporter;
  // Pull the latest collected batch from the metric reader.
  collectMetrics(): Promise<void>;
  reset(): void;
};

export function createTestTelemetry(): TestTelemetry {
  resetInstrumentsForTest();
  resetTelemetryForTest();

  const spanExporter = new InMemorySpanExporter();
  const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 60_000,
  });

  const handle = installTelemetryForTest({
    spanProcessors: [new SimpleSpanProcessor(spanExporter)],
    metricReaders: [metricReader],
  });

  return {
    handle,
    spanExporter,
    metricExporter,
    async collectMetrics() {
      await handle.meterProvider.forceFlush();
    },
    reset() {
      spanExporter.reset();
      metricExporter.reset();
    },
  };
}
