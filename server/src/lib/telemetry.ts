type Properties = Record<string, string | number | boolean | null | undefined>;
type Measurements = Record<string, number>;

let client: any = null;

if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  try {
    // Keep telemetry optional for local development and tests. Production uses
    // the official Azure Monitor Application Insights Node SDK.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appInsights = require('applicationinsights');
    const setup = appInsights
      .setup()
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(false, false)
      .setAutoCollectPreAggregatedMetrics(true)
      .setSendLiveMetrics(process.env.APPLICATIONINSIGHTS_LIVE_METRICS === 'true');
    client = appInsights.defaultClient;
    const sampling = Number(process.env.APPLICATIONINSIGHTS_SAMPLING_PERCENTAGE || 100);
    if (Number.isFinite(sampling)) client.config.samplingPercentage = Math.max(0, Math.min(100, sampling));
    setup.start();
  } catch (error) {
    console.error('[telemetry] Application Insights failed to initialize:', error);
  }
}

function cleanProperties(properties: Properties): Record<string, string> {
  return Object.fromEntries(
    Object.entries(properties)
      .filter(([, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

export function trackEvent(name: string, properties: Properties = {}, measurements: Measurements = {}): void {
  client?.trackEvent({ name, properties: cleanProperties(properties), measurements });
}

export function trackMetric(name: string, value: number, properties: Properties = {}): void {
  if (!Number.isFinite(value)) return;
  client?.trackMetric({ name, value, properties: cleanProperties(properties) });
}

export function trackException(error: unknown, properties: Properties = {}): void {
  const exception = error instanceof Error ? error : new Error(String(error));
  client?.trackException({ exception, properties: cleanProperties(properties) });
}

process.on('uncaughtExceptionMonitor', (error) => trackException(error, { source: 'uncaughtException' }));
