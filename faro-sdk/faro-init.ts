/**
 * Grafana Faro SDK Initialization
 * Real User Monitoring (RUM) for Angular Application
 *
 * Captures: Web Vitals, Console Logs, JS Errors, HTTP Events, Distributed Traces
 * Sends to: Alloy DaemonSet via dedicated ALB → Loki/Prometheus/Tempo
 */

import { initializeFaro, BrowserConfig } from '@grafana/faro-web-sdk';
import { getWebInstrumentations } from '@grafana/faro-web-sdk';
import { TracingInstrumentation } from '@grafana/faro-web-tracing';
import { environment } from './environment.config';

/**
 * Initialize Faro SDK with environment-specific configuration
 * Called in main.ts before Angular bootstrapping
 */
export function initFaro(): void {
  // Only initialize in non-local environments
  if (!environment.faroEnabled) {
    console.log('[Faro] Disabled for local development');
    return;
  }

  const faroConfig: BrowserConfig = {
    // Collector endpoint — routed through dedicated Alloy ALB
    url: environment.faroCollectorUrl,

    app: {
      name: 'enterprise-platform',
      version: environment.appVersion,
      environment: environment.name,
    },

    // Instrumentations — what to capture
    instrumentations: [
      // Built-in web instrumentations
      ...getWebInstrumentations({
        // Capture all console levels (log, warn, error, debug, info)
        captureConsole: true,
        captureConsoleDisabledLevels: [],
      }),

      // Distributed tracing via OpenTelemetry
      new TracingInstrumentation({
        instrumentationOptions: {
          // Propagate trace context to backend API calls
          propagateTraceHeaderCorsUrls: [
            new RegExp(`${environment.apiBaseUrl}.*`),
          ],
        },
      }),
    ],

    // Session tracking
    sessionTracking: {
      enabled: true,
      persistent: true,  // Survive page refreshes
    },

    // Batching configuration
    batching: {
      enabled: true,
      sendTimeout: 250,     // Send batch every 250ms
      itemLimit: 50,        // Or when 50 items accumulated
    },
  };

  try {
    const faro = initializeFaro(faroConfig);
    console.log('[Faro] SDK initialized successfully');
    console.log(`[Faro] Collector: ${environment.faroCollectorUrl}`);
    console.log(`[Faro] Environment: ${environment.name}`);
  } catch (error) {
    // Faro failure should never break the application
    console.error('[Faro] Failed to initialize:', error);
  }
}
