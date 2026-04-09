import { MemgraphService } from '../src/lib/memgraph';

/**
 * Example: Using Memgraph Service for Code Analysis
 * 
 * This example demonstrates how to:
 * 1. Initialize the Memgraph service
 * 2. Index a project
 * 3. Analyze deprecations
 * 4. Generate reports
 */

async function example() {
  const service = new MemgraphService();

  try {
    // Step 1: Initialize Memgraph
    console.log('📊 Initializing Memgraph...');
    await service.initialize();
    console.log('✓ Memgraph initialized\n');

    // Step 2: Index your project
    console.log('📁 Indexing project...');
    await service.indexProject('./src');
    console.log('✓ Project indexed\n');

    // Step 3: Analyze a specific deprecated API
    console.log('🔍 Analyzing deprecated API: ChatCompletion.create\n');
    const context = await service.getDeprecationContext('ChatCompletion.create');
    
    console.log('Deprecation Context:');
    console.log(`  API Name: ${context.apiName}`);
    console.log(`  Total Usages: ${context.totalUsages}`);
    console.log(`  Impacted Files: ${context.impactedFiles}`);
    console.log(`  Risk Score: ${context.riskScore}%`);
    console.log(`  Estimated Effort: ${context.refactoringPath.estimatedEffort}\n`);

    if (context.usages.length > 0) {
      console.log('Usages:');
      context.usages.forEach(usage => {
        console.log(`  - ${usage.filePath}:${usage.lineNumber} in ${usage.functionName}()`);
      });
      console.log();
    }

    console.log('Refactoring Path:');
    console.log(`  From: ${context.refactoringPath.from}`);
    console.log(`  To: ${context.refactoringPath.to}`);
    console.log(`  Steps:`);
    context.refactoringPath.steps.forEach((step, i) => {
      console.log(`    ${i + 1}. ${step}`);
    });
    console.log();

    // Step 4: Find all deprecated APIs
    console.log('📋 Finding all deprecated APIs...');
    const allApis = await service.findAllDeprecatedApis();
    console.log(`Found ${allApis.length} deprecated APIs\n`);

    // Step 5: Generate full report
    console.log('📊 Generating report...');
    const report = await service.generateReport();
    console.log('Report:');
    console.log(`  Total Files: ${report.totalFiles}`);
    console.log(`  Total Deprecations: ${report.totalDeprecations}`);
    console.log(`  Files with Deprecations: ${report.files.length}\n`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Step 6: Cleanup
    console.log('🛑 Shutting down...');
    await service.shutdown();
    console.log('✓ Done\n');
  }
}

// Run the example
example().catch(console.error);
