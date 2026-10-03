/**
 * @helios/test-suite
 * Test runner fixtures, specification corpuses, performance benchmarks, and offline AI verification suites.
 */

import type { HeliosSpec } from '@helios/canonical-ast';

export interface FixtureSpec {
  id: string;
  name: string;
  dialect: '2.0' | '3.0' | '3.1';
  format: 'json' | 'yaml';
  rawContent: string;
  description: string;
  expectedEndpointCount: number;
}

export interface BenchmarkMeasurement {
  name: string;
  durationMs: number;
  memoryUsageBytes: number;
  throughputOpsPerSec: number;
}

export interface OfflineAiTestCase {
  id: string;
  description: string;
  spec: HeliosSpec;
  testPrompt: string;
  expectedKeywords: string[];
  prohibitedHallucinations: string[];
}

export interface TestSuiteHarness {
  loadFixtures(): Promise<FixtureSpec[]>;
  runOfflineAiVerification(testCases: OfflineAiTestCase[]): Promise<boolean>;
}
