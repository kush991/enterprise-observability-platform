/**
 * Environment Configuration for Faro SDK
 * Each environment points to its own Alloy ALB endpoint
 */

interface EnvironmentConfig {
  name: string;
  appVersion: string;
  faroEnabled: boolean;
  faroCollectorUrl: string;
  apiBaseUrl: string;
}

// --- Development ---
export const devEnvironment: EnvironmentConfig = {
  name: 'dev',
  appVersion: '1.0.0',
  faroEnabled: true,
  faroCollectorUrl: 'https://alloy-dev.example.com/collect',
  apiBaseUrl: 'https://api-dev.example.com',
};

// --- Test ---
export const testEnvironment: EnvironmentConfig = {
  name: 'test',
  appVersion: '1.0.0',
  faroEnabled: true,
  faroCollectorUrl: 'https://alloy-test.example.com/collect',
  apiBaseUrl: 'https://api-test.example.com',
};

// --- Production ---
export const prodEnvironment: EnvironmentConfig = {
  name: 'prod',
  appVersion: '1.0.0',
  faroEnabled: true,
  faroCollectorUrl: 'https://alloy.example.com/collect',
  apiBaseUrl: 'https://api.example.com',
};

// --- Local Development ---
export const localEnvironment: EnvironmentConfig = {
  name: 'local',
  appVersion: '0.0.0-local',
  faroEnabled: false,  // Disabled locally
  faroCollectorUrl: '',
  apiBaseUrl: 'http://localhost:8080',
};

// Export active environment (set via build pipeline)
export const environment: EnvironmentConfig = devEnvironment;
