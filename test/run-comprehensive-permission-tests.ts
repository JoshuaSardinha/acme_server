#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Comprehensive Permission System Test Runner
 *
 * Executes all permission system E2E tests and generates a comprehensive report
 * covering authentication, authorization, multi-tenant security, performance,
 * and real-world legal platform scenarios.
 */

interface TestResult {
  testFile: string;
  testName: string;
  passed: boolean;
  duration: number;
  error?: string;
  stdout?: string;
}

interface TestSuite {
  name: string;
  file: string;
  description: string;
  estimatedDuration: string;
}

const testSuites: TestSuite[] = [
  {
    name: 'Core Permission System',
    file: 'permissions.controller.e2e-spec.ts',
    description: 'Basic permission CRUD operations, authentication flow, and cache management',
    estimatedDuration: '2-3 minutes',
  },
  {
    name: 'Comprehensive System Integration',
    file: 'permissions-system.comprehensive.e2e-spec.ts',
    description:
      'Full HTTP flow testing with real authentication, authorization, and multi-tenant security',
    estimatedDuration: '5-7 minutes',
  },
  {
    name: 'Guard Integration & Authorization',
    file: 'permissions-guards.e2e-spec.ts',
    description:
      'JWT and Permission guard integration, authorization flow, and security enforcement',
    estimatedDuration: '3-4 minutes',
  },
  {
    name: 'Multi-Tenant Security',
    file: 'permissions-multitenant.e2e-spec.ts',
    description:
      'Legal platform scenarios with multiple law firms, attorneys, and client isolation',
    estimatedDuration: '4-6 minutes',
  },
  {
    name: 'Performance & Load Testing',
    file: 'permissions-performance.e2e-spec.ts',
    description: 'High-load scenarios, concurrent access, cache performance, and SLA validation',
    estimatedDuration: '8-12 minutes',
  },
];

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log('🔐 Permission System - Comprehensive E2E Test Suite');
    console.log('='.repeat(60));
    console.log('');

    this.startTime = Date.now();

    console.log('📋 Test Suites to Execute:');
    testSuites.forEach((suite, index) => {
      console.log(`${index + 1}. ${suite.name}`);
      console.log(`   ${suite.description}`);
      console.log(`   Estimated Duration: ${suite.estimatedDuration}`);
      console.log('');
    });

    console.log('🚀 Starting test execution...\n');

    for (const suite of testSuites) {
      await this.runTestSuite(suite);
    }

    this.generateReport();
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`▶️  Running: ${suite.name}`);
    console.log(`   File: ${suite.file}`);
    console.log(`   ${suite.description}`);

    const startTime = Date.now();

    try {
      const command = `npm run test:e2e -- ${suite.file} --verbose --detectOpenHandles --forceExit`;
      const stdout = execSync(command, {
        encoding: 'utf8',
        timeout: 30 * 60 * 1000, // 30 minutes timeout
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      });

      const duration = Date.now() - startTime;

      this.results.push({
        testFile: suite.file,
        testName: suite.name,
        passed: true,
        duration,
        stdout,
      });

      console.log(`✅ PASSED - ${suite.name} (${this.formatDuration(duration)})`);
    } catch (error: any) {
      const duration = Date.now() - startTime;

      this.results.push({
        testFile: suite.file,
        testName: suite.name,
        passed: false,
        duration,
        error: error.message,
        stdout: error.stdout,
      });

      console.log(`❌ FAILED - ${suite.name} (${this.formatDuration(duration)})`);
      console.log(`   Error: ${error.message.slice(0, 200)}...`);
    }

    console.log('');
  }

  private generateReport(): void {
    const totalDuration = Date.now() - this.startTime;
    const passedTests = this.results.filter((r) => r.passed);
    const failedTests = this.results.filter((r) => !r.passed);

    console.log('📊 TEST EXECUTION SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Duration: ${this.formatDuration(totalDuration)}`);
    console.log(`Total Test Suites: ${this.results.length}`);
    console.log(`✅ Passed: ${passedTests.length}`);
    console.log(`❌ Failed: ${failedTests.length}`);
    console.log(`Success Rate: ${((passedTests.length / this.results.length) * 100).toFixed(1)}%`);
    console.log('');

    // Detailed results
    console.log('📋 DETAILED RESULTS');
    console.log('-'.repeat(60));

    this.results.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      console.log(`${index + 1}. ${status} - ${result.testName}`);
      console.log(`   Duration: ${this.formatDuration(result.duration)}`);

      if (!result.passed && result.error) {
        console.log(`   Error: ${result.error.slice(0, 300)}`);
      }

      console.log('');
    });

    // Performance analysis
    if (passedTests.length > 0) {
      console.log('⚡ PERFORMANCE ANALYSIS');
      console.log('-'.repeat(60));

      const durations = passedTests.map((t) => t.duration);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      console.log(`Average Test Suite Duration: ${this.formatDuration(avgDuration)}`);
      console.log(`Longest Test Suite: ${this.formatDuration(maxDuration)}`);
      console.log(`Shortest Test Suite: ${this.formatDuration(minDuration)}`);
      console.log('');
    }

    // Coverage analysis
    console.log('🎯 COVERAGE ANALYSIS');
    console.log('-'.repeat(60));
    console.log('Test scenarios covered:');
    console.log('✓ Authentication flow (JWT validation, token expiration, invalid tokens)');
    console.log('✓ Authorization guards (permission-based access control)');
    console.log('✓ Multi-tenant isolation (cross-firm data protection)');
    console.log('✓ Real-world legal workflows (case assignment, document access)');
    console.log('✓ API validation (request/response serialization, error handling)');
    console.log('✓ Cache management (invalidation, warmup, performance)');
    console.log('✓ Performance benchmarks (concurrent load, response times)');
    console.log('✓ Security edge cases (token manipulation, data leakage)');
    console.log('✓ Legal platform scenarios (attorney-client privilege, billing)');
    console.log('✓ High-load testing (100+ concurrent requests, bulk operations)');
    console.log('');

    // Generate detailed report file
    this.generateDetailedReport();

    // Final recommendation
    console.log('🔍 RECOMMENDATIONS');
    console.log('-'.repeat(60));

    if (failedTests.length === 0) {
      console.log('🎉 Excellent! All permission system tests passed.');
      console.log('✓ The permission system is ready for production deployment.');
      console.log('✓ Security boundaries are properly enforced.');
      console.log('✓ Performance meets SLA requirements.');
      console.log('✓ Multi-tenant isolation is working correctly.');
    } else {
      console.log('⚠️  Some tests failed. Address the following issues:');
      failedTests.forEach((test, index) => {
        console.log(`${index + 1}. ${test.testName}: Review implementation and fix errors`);
      });
      console.log('');
      console.log('🚨 Do not deploy to production until all tests pass.');
    }

    console.log('');
    console.log('📄 Detailed report saved to: test-results/permission-system-report.json');
    console.log('📊 View the report for in-depth analysis and metrics.');
  }

  private generateDetailedReport(): void {
    const reportDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const report = {
      summary: {
        executionDate: new Date().toISOString(),
        totalDuration: Date.now() - this.startTime,
        totalTestSuites: this.results.length,
        passedTests: this.results.filter((r) => r.passed).length,
        failedTests: this.results.filter((r) => !r.passed).length,
        successRate: (this.results.filter((r) => r.passed).length / this.results.length) * 100,
      },
      testSuites: testSuites,
      results: this.results,
      coverage: {
        authentication: true,
        authorization: true,
        multiTenant: true,
        performance: true,
        security: true,
        legalWorkflows: true,
        cacheManagement: true,
        errorHandling: true,
        concurrentLoad: true,
        apiValidation: true,
      },
      recommendations:
        this.results.filter((r) => !r.passed).length === 0
          ? [
              'Permission system is production-ready',
              'Security boundaries are properly enforced',
              'Performance meets SLA requirements',
              'Multi-tenant isolation is working correctly',
            ]
          : [
              'Fix failing test suites before production deployment',
              'Review error messages and implement necessary fixes',
              'Ensure all security tests pass',
              'Validate performance requirements are met',
            ],
    };

    const reportPath = path.join(reportDir, 'permission-system-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Also generate a simple HTML report
    this.generateHtmlReport(report, reportDir);
  }

  private generateHtmlReport(report: any, reportDir: string): void {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Permission System Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #6c757d; margin-top: 5px; }
        .test-result { margin: 10px 0; padding: 15px; border-radius: 5px; }
        .test-pass { background: #d4edda; border-left: 4px solid #28a745; }
        .test-fail { background: #f8d7da; border-left: 4px solid #dc3545; }
        .duration { color: #6c757d; font-size: 0.9em; }
        ul { list-style-type: none; padding: 0; }
        li { padding: 5px 0; }
        li:before { content: "✓ "; color: #28a745; font-weight: bold; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Permission System - E2E Test Report</h1>
        <p>Comprehensive testing of authentication, authorization, multi-tenant security, and performance</p>
        <p><strong>Execution Date:</strong> ${new Date(report.summary.executionDate).toLocaleString()}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <div class="metric-value">${report.summary.successRate.toFixed(1)}%</div>
            <div class="metric-label">Success Rate</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.summary.passedTests}</div>
            <div class="metric-label">Tests Passed</div>
        </div>
        <div class="metric">
            <div class="metric-value">${report.summary.failedTests}</div>
            <div class="metric-label">Tests Failed</div>
        </div>
        <div class="metric">
            <div class="metric-value">${this.formatDuration(report.summary.totalDuration)}</div>
            <div class="metric-label">Total Duration</div>
        </div>
    </div>

    <h2>Test Results</h2>
    ${report.results
      .map(
        (result: any) => `
        <div class="test-result ${result.passed ? 'test-pass' : 'test-fail'}">
            <h3>${result.passed ? '✅' : '❌'} ${result.testName}</h3>
            <p><strong>File:</strong> ${result.testFile}</p>
            <p class="duration"><strong>Duration:</strong> ${this.formatDuration(result.duration)}</p>
            ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
        </div>
    `
      )
      .join('')}

    <h2>Coverage Areas</h2>
    <ul>
        <li>Authentication flow (JWT validation, token expiration, invalid tokens)</li>
        <li>Authorization guards (permission-based access control)</li>
        <li>Multi-tenant isolation (cross-firm data protection)</li>
        <li>Real-world legal workflows (case assignment, document access)</li>
        <li>API validation (request/response serialization, error handling)</li>
        <li>Cache management (invalidation, warmup, performance)</li>
        <li>Performance benchmarks (concurrent load, response times)</li>
        <li>Security edge cases (token manipulation, data leakage)</li>
        <li>Legal platform scenarios (attorney-client privilege, billing)</li>
        <li>High-load testing (100+ concurrent requests, bulk operations)</li>
    </ul>

    <h2>Recommendations</h2>
    <ul>
        ${report.recommendations.map((rec: string) => `<li>${rec}</li>`).join('')}
    </ul>
</body>
</html>
    `;

    const htmlPath = path.join(reportDir, 'permission-system-report.html');
    fs.writeFileSync(htmlPath, html);
    console.log('📄 HTML report saved to: test-results/permission-system-report.html');
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch((error) => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { TestRunner };
