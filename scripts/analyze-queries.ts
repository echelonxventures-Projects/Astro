#!/usr/bin/env node
/**
 * Query Analyzer Script
 * Analyzes slow queries, identifies N+1 patterns, and suggests optimizations
 * Usage: npx ts-node scripts/analyze-queries.ts [options]
 */

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../src/lib/db-connection';

// Configuration
const LOG_FILE = process.env.QUERY_LOG_FILE || './logs/query.log';
const SLOW_QUERY_THRESHOLD = parseInt(process.env.SLOW_QUERY_THRESHOLD || '100', 10);
const ANALYSIS_OUTPUT = process.env.ANALYSIS_OUTPUT || './logs/query-analysis.json';

interface QueryLog {
  timestamp: string;
  model?: string;
  action?: string;
  durationMs: number;
  args?: Record<string, unknown>;
  query?: string;
}

interface QueryPattern {
  pattern: string;
  count: number;
  totalDuration: number;
  avgDuration: number;
  maxDuration: number;
  slowQueries: QueryLog[];
}

interface AnalysisResult {
  timestamp: string;
  totalQueries: number;
  slowQueries: number;
  patterns: QueryPattern[];
  recommendations: string[];
  nPlusOneSuspects: string[];
}

/**
 * Parse log file for query entries
 */
function parseLogFile(filePath: string): QueryLog[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`Log file not found: ${filePath}`);
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const queries: QueryLog[] = [];

  // Parse JSON lines (assuming structured logging)
  const lines = content.split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      if (entry.durationMs || entry.message?.includes('query')) {
        queries.push({
          timestamp: entry.timestamp || entry.time || new Date().toISOString(),
          model: entry.model,
          action: entry.action,
          durationMs: entry.durationMs || 0,
          args: entry.args,
          query: entry.query,
        });
      }
    } catch {
      // Skip non-JSON lines
    }
  }

  return queries;
}

/**
 * Analyze query patterns
 */
function analyzePatterns(queries: QueryLog[]): QueryPattern[] {
  const patterns = new Map<string, QueryPattern>();

  for (const query of queries) {
    const patternKey = `${query.model}.${query.action}`;

    if (!patterns.has(patternKey)) {
      patterns.set(patternKey, {
        pattern: patternKey,
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        maxDuration: 0,
        slowQueries: [],
      });
    }

    const pattern = patterns.get(patternKey)!;
    pattern.count++;
    pattern.totalDuration += query.durationMs;
    pattern.maxDuration = Math.max(pattern.maxDuration, query.durationMs);

    if (query.durationMs > SLOW_QUERY_THRESHOLD) {
      pattern.slowQueries.push(query);
    }
  }

  // Calculate averages and convert to array
  const result = Array.from(patterns.values()).map(p => ({
    ...p,
    avgDuration: p.count > 0 ? p.totalDuration / p.count : 0,
  }));

  // Sort by total duration (most impactful first)
  return result.sort((a, b) => b.totalDuration - a.totalDuration);
}

/**
 * Detect potential N+1 patterns
 */
function detectNPlusOne(patterns: QueryPattern[]): string[] {
  const suspects: string[] = [];

  // Look for repeated single-record lookups in the same model
  const singleRecordPatterns = patterns.filter(
    p => p.pattern.includes('.findUnique') || p.pattern.includes('.findFirst')
  );

  // Group by model and check for high counts
  const modelCounts = new Map<string, number>();
  for (const p of singleRecordPatterns) {
    const model = p.pattern.split('.')[0];
    modelCounts.set(model, (modelCounts.get(model) || 0) + p.count);
  }

  // Flag models with high single-query counts
  for (const [model, count] of modelCounts) {
    if (count > 50) {
      suspects.push(
        `High volume of single-record queries for ${model} (${count} queries) - potential N+1`
      );
    }
  }

  return suspects;
}

/**
 * Generate optimization recommendations
 */
function generateRecommendations(patterns: QueryPattern[], nPlusOneSuspects: string[]): string[] {
  const recommendations: string[] = [];

  // Recommend indexes for slow patterns
  const slowPatterns = patterns.filter(p => p.avgDuration > SLOW_QUERY_THRESHOLD);
  for (const p of slowPatterns) {
    const [model, action] = p.pattern.split('.');
    if (action?.includes('findMany') || action?.includes('count')) {
      recommendations.push(
        `Consider adding indexes for ${model} to speed up ${action} (avg: ${p.avgDuration.toFixed(2)}ms)`
      );
    }
  }

  // Add N+1 recommendations
  for (const suspect of nPlusOneSuspects) {
    recommendations.push(`N+1 Detection: ${suspect}. Consider using 'include' or batch queries.`);
  }

  // Connection pool recommendations
  const totalQueries = patterns.reduce((sum, p) => sum + p.count, 0);
  if (totalQueries > 1000) {
    recommendations.push(
      'High query volume detected. Consider increasing connection pool size or implementing caching.'
    );
  }

  return recommendations;
}

/**
 * Check current database indexes
 */
async function checkIndexes(): Promise<void> {
  console.log('\n=== Current Database Indexes ===\n');

  try {
    // Query for indexes (PostgreSQL specific)
    const indexes = await prisma.$queryRaw<Array<{
      table_name: string;
      index_name: string;
      column_name: string;
    }>>`
      SELECT
        t.relname AS table_name,
        i.relname AS index_name,
        a.attname AS column_name
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON ix.indexrelid = i.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE t.relkind = 'r'
      AND t.relname NOT LIKE 'pg_%'
      AND t.relname NOT LIKE '_prisma%'
      ORDER BY t.relname, i.relname
    `;

    const grouped = indexes.reduce((acc, idx) => {
      if (!acc[idx.table_name]) acc[idx.table_name] = [];
      acc[idx.table_name].push({
        name: idx.index_name,
        column: idx.column_name,
      });
      return acc;
    }, {} as Record<string, Array<{ name: string; column: string }>>);

    for (const [table, idxs] of Object.entries(grouped)) {
      console.log(`Table: ${table}`);
      for (const idx of idxs) {
        console.log(`  - ${idx.name}: ${idx.column}`);
      }
      console.log('');
    }
  } catch (error) {
    console.log('Could not retrieve indexes (may be running on SQLite):',
      error instanceof Error ? error.message : String(error));
  }
}

/**
 * Main analysis function
 */
async function analyzeQueries(): Promise<AnalysisResult> {
  console.log('Analyzing queries...');

  // Parse log file
  const queries = parseLogFile(LOG_FILE);
  console.log(`Found ${queries.length} query log entries`);

  // Analyze patterns
  const patterns = analyzePatterns(queries);
  const slowQueries = queries.filter(q => q.durationMs > SLOW_QUERY_THRESHOLD);
  const nPlusOneSuspects = detectNPlusOne(patterns);
  const recommendations = generateRecommendations(patterns, nPlusOneSuspects);

  const result: AnalysisResult = {
    timestamp: new Date().toISOString(),
    totalQueries: queries.length,
    slowQueries: slowQueries.length,
    patterns,
    recommendations,
    nPlusOneSuspects,
  };

  return result;
}

/**
 * Print analysis results
 */
function printResults(result: AnalysisResult): void {
  console.log('\n=== Query Analysis Results ===\n');
  console.log(`Timestamp: ${result.timestamp}`);
  console.log(`Total Queries: ${result.totalQueries}`);
  console.log(`Slow Queries (> ${SLOW_QUERY_THRESHOLD}ms): ${result.slowQueries}`);

  console.log('\n=== Top Query Patterns ===\n');
  result.patterns.slice(0, 10).forEach((p, i) => {
    console.log(`${i + 1}. ${p.pattern}`);
    console.log(`   Count: ${p.count}`);
    console.log(`   Avg Duration: ${p.avgDuration.toFixed(2)}ms`);
    console.log(`   Max Duration: ${p.maxDuration.toFixed(2)}ms`);
    console.log(`   Slow Queries: ${p.slowQueries.length}`);
    console.log('');
  });

  if (result.nPlusOneSuspects.length > 0) {
    console.log('=== N+1 Query Suspects ===\n');
    result.nPlusOneSuspects.forEach(suspect => {
      console.log(`⚠️  ${suspect}`);
    });
    console.log('');
  }

  if (result.recommendations.length > 0) {
    console.log('=== Recommendations ===\n');
    result.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    console.log('');
  }
}

/**
 * Save results to file
 */
function saveResults(result: AnalysisResult): void {
  const outputDir = path.dirname(ANALYSIS_OUTPUT);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(ANALYSIS_OUTPUT, JSON.stringify(result, null, 2));
  console.log(`Results saved to: ${ANALYSIS_OUTPUT}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const shouldCheckIndexes = args.includes('--indexes');
  const shouldSaveResults = !args.includes('--no-save');

  try {
    // Run analysis
    const result = await analyzeQueries();
    printResults(result);

    // Optionally check indexes
    if (shouldCheckIndexes) {
      await checkIndexes();
    }

    // Save results
    if (shouldSaveResults) {
      saveResults(result);
    }
  } catch (error) {
    console.error('Analysis failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { analyzeQueries, parseLogFile, analyzePatterns, detectNPlusOne };
