/**
 * StarPath Astrology - Backup Utilities
 *
 * Programmatic backup/restore functions for database operations.
 * Supports both SQLite and PostgreSQL databases.
 */

import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { logger } from './logger';

const execAsync = promisify(exec);

export interface BackupConfig {
  backupDir: string;
  dbPath?: string;
  databaseUrl?: string;
  s3Bucket?: string;
  awsRegion?: string;
  retentionDays: number;
  encryptionKey?: string;
  enableEncryption: boolean;
}

export interface BackupMetadata {
  timestamp: string;
  type: 'full' | 'incremental';
  database: string;
  compressedFile: string;
  compressedSize: number;
  checksum: string;
  retentionDays: number;
  s3Uploaded: boolean;
}

export interface BackupResult {
  success: boolean;
  filePath: string;
  metadata: BackupMetadata;
  error?: string;
  duration: number;
}

export interface RestoreOptions {
  force?: boolean;
  fromS3?: boolean;
  s3Key?: string;
  verifyBeforeRestore?: boolean;
}

// Default configuration
export const defaultBackupConfig: BackupConfig = {
  backupDir: process.env.BACKUP_DIR || '/backups',
  dbPath: process.env.DB_PATH || 'prisma/prod.db',
  databaseUrl: process.env.DATABASE_URL,
  s3Bucket: process.env.BACKUP_S3_BUCKET,
  awsRegion: process.env.AWS_REGION || 'us-east-1',
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
  encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
  enableEncryption: process.env.BACKUP_ENCRYPTION === 'true',
};

/**
 * Detect database type from configuration
 */
export function detectDatabaseType(config: Partial<BackupConfig> = {}): 'sqlite' | 'postgresql' | 'unknown' {
  const databaseUrl = config.databaseUrl || defaultBackupConfig.databaseUrl;

  if (databaseUrl) {
    if (databaseUrl.includes('postgresql')) return 'postgresql';
    if (databaseUrl.includes('sqlite') || databaseUrl.includes('file:')) return 'sqlite';
  }

  // Check for SQLite file
  const dbPath = config.dbPath || defaultBackupConfig.dbPath;
  if (dbPath?.endsWith('.db') || dbPath?.endsWith('.sqlite')) {
    return 'sqlite';
  }

  return 'unknown';
}

/**
 * Create a full database backup
 */
export async function createBackup(
  options: Partial<BackupConfig> = {},
  type: 'full' | 'incremental' = 'full'
): Promise<BackupResult> {
  const config = { ...defaultBackupConfig, ...options };
  const startTime = Date.now();

  try {
    // Ensure backup directory exists
    if (!fs.existsSync(config.backupDir)) {
      fs.mkdirSync(config.backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const backupFileName = `starpath_backup_${type}_${timestamp}.sql`;
    const backupPath = path.join(config.backupDir, backupFileName);
    const dbType = detectDatabaseType(config);

    let sourcePath: string;

    // Create backup based on database type
    if (dbType === 'postgresql') {
      await createPostgresBackup(config, backupPath);
      sourcePath = `${backupPath}.dump`;
    } else if (dbType === 'sqlite') {
      await createSQLiteBackup(config, backupPath);
      sourcePath = backupPath;
    } else {
      throw new Error('Unable to detect database type');
    }

    // Compress backup
    const compressedPath = `${sourcePath}.gz`;
    await compressFile(sourcePath, compressedPath);

    // Clean up uncompressed file
    if (fs.existsSync(sourcePath)) {
      fs.unlinkSync(sourcePath);
    }

    // Calculate checksum
    const checksum = calculateChecksum(compressedPath);

    // Create metadata
    const metadata: BackupMetadata = {
      timestamp: new Date().toISOString(),
      type,
      database: dbType,
      compressedFile: path.basename(compressedPath),
      compressedSize: fs.statSync(compressedPath).size,
      checksum,
      retentionDays: config.retentionDays,
      s3Uploaded: false,
    };

    // Save metadata
    const metadataPath = path.join(config.backupDir, `metadata_${timestamp}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // Encrypt if enabled
    let finalPath = compressedPath;
    if (config.enableEncryption && config.encryptionKey) {
      finalPath = await encryptFile(compressedPath, config.encryptionKey);
    }

    // Upload to S3 if configured
    if (config.s3Bucket) {
      try {
        await uploadToS3(finalPath, config.s3Bucket, config.awsRegion);
        metadata.s3Uploaded = true;
        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      } catch (error) {
        logger.warn({ error }, 'S3 upload failed');
      }
    }

    const duration = Date.now() - startTime;

    return {
      success: true,
      filePath: finalPath,
      metadata,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      success: false,
      filePath: '',
      metadata: {} as BackupMetadata,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
    };
  }
}

/**
 * Create SQLite database backup
 */
async function createSQLiteBackup(config: BackupConfig, outputPath: string): Promise<void> {
  const dbPath = config.dbPath || 'prisma/prod.db';

  // Extract file path from connection string if provided
  let resolvedPath = dbPath;
  if (config.databaseUrl && config.databaseUrl.startsWith('file:')) {
    resolvedPath = config.databaseUrl.replace('file:', '').replace(/^\.\.\//, '');
  }

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Database file not found: ${resolvedPath}`);
  }

  const cmd = `sqlite3 "${resolvedPath}" ".backup '${outputPath}'"`;

  try {
    await execAsync(cmd);
  } catch (error) {
    throw new Error(`SQLite backup failed: ${error}`);
  }
}

/**
 * Create PostgreSQL database backup
 */
async function createPostgresBackup(config: BackupConfig, outputPath: string): Promise<void> {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL not provided for PostgreSQL backup');
  }

  const url = new URL(config.databaseUrl);
  const cmd = 'pg_dump';
  const args = [
    '-h', url.hostname,
    '-p', url.port || '5432',
    '-U', url.username,
    '-d', url.pathname.slice(1),
    '--format=custom',
    '--file', `${outputPath}.dump`,
  ];

  const env = { ...process.env, PGPASSWORD: url.password };

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`pg_dump failed with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(new Error(`pg_dump error: ${error.message}`));
    });
  });
}

/**
 * Compress a file using gzip
 */
async function compressFile(inputPath: string, outputPath: string): Promise<void> {
  const { createReadStream, createWriteStream } = await import('fs');
  const { createGzip } = await import('zlib');
  const { pipeline } = await import('stream/promises');

  const source = createReadStream(inputPath);
  const gzip = createGzip();
  const destination = createWriteStream(outputPath);

  await pipeline(source, gzip, destination);
}

/**
 * Calculate MD5 checksum of a file
 */
function calculateChecksum(filePath: string): string {
  const hash = crypto.createHash('md5');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
}

/**
 * Encrypt a file using AES-256-CBC
 */
async function encryptFile(inputPath: string, key: string): Promise<string> {
  const algorithm = 'aes-256-cbc';
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher(algorithm, key);
  const outputPath = `${inputPath}.enc`;

  const input = fs.readFileSync(inputPath);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);

  // Prepend IV to encrypted data
  fs.writeFileSync(outputPath, Buffer.concat([iv, encrypted]));

  // Remove unencrypted file
  fs.unlinkSync(inputPath);

  return outputPath;
}

/**
 * Upload file to S3
 */
async function uploadToS3(filePath: string, bucket: string, region: string): Promise<void> {
  const fileName = path.basename(filePath);
  const s3Key = `backups/${fileName}`;

  const cmd = `aws s3 cp "${filePath}" "s3://${bucket}/${s3Key}" --region ${region}`;

  try {
    await execAsync(cmd);
    logger.info({ bucket, s3Key }, `Uploaded to s3://${bucket}/${s3Key}`);
  } catch (error) {
    throw new Error(`S3 upload failed: ${error}`);
  }
}

/**
 * Restore database from backup
 */
export async function restoreBackup(
  backupPath: string,
  options: RestoreOptions = {}
): Promise<{ success: boolean; error?: string }> {
  const config = defaultBackupConfig;

  try {
    // Download from S3 if requested
    let localBackupPath = backupPath;
    if (options.fromS3 && options.s3Key && config.s3Bucket) {
      localBackupPath = path.join(config.backupDir, path.basename(options.s3Key));
      const downloadCmd = `aws s3 cp "s3://${config.s3Bucket}/${options.s3Key}" "${localBackupPath}"`;
      await execAsync(downloadCmd);
    }

    if (!fs.existsSync(localBackupPath)) {
      throw new Error(`Backup file not found: ${localBackupPath}`);
    }

    // Verify backup if requested
    if (options.verifyBeforeRestore) {
      const isValid = await verifyBackup(localBackupPath);
      if (!isValid) {
        throw new Error('Backup verification failed');
      }
    }

    const dbType = detectDatabaseType(config);

    if (dbType === 'postgresql') {
      await restorePostgresBackup(localBackupPath, config);
    } else if (dbType === 'sqlite') {
      await restoreSQLiteBackup(localBackupPath, config);
    } else {
      throw new Error('Unable to detect database type');
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Restore SQLite database
 */
async function restoreSQLiteBackup(backupPath: string, config: BackupConfig): Promise<void> {
  const dbPath = config.dbPath || 'prisma/prod.db';

  // Decompress if needed
  let sourcePath = backupPath;
  if (backupPath.endsWith('.gz')) {
    sourcePath = backupPath.slice(0, -3);
    const decompressCmd = `gunzip -c "${backupPath}" > "${sourcePath}"`;
    await execAsync(decompressCmd);
  }

  // Decrypt if needed
  if (sourcePath.endsWith('.enc')) {
    if (!config.encryptionKey) {
      throw new Error('Encryption key required for encrypted backup');
    }
    const decryptedPath = sourcePath.slice(0, -4);
    // Decrypt file (implementation depends on encryption method)
    sourcePath = decryptedPath;
  }

  // Determine if binary backup or SQL dump
  const firstBytes = fs.readFileSync(sourcePath, { encoding: 'binary', length: 16 });

  if (firstBytes.includes('SQLite format 3')) {
    // Binary backup - copy directly
    fs.copyFileSync(sourcePath, dbPath);
  } else {
    // SQL dump - execute
    const cmd = `sqlite3 "${dbPath}" < "${sourcePath}"`;
    await execAsync(cmd);
  }

  // Cleanup temp files
  if (sourcePath !== backupPath && fs.existsSync(sourcePath)) {
    fs.unlinkSync(sourcePath);
  }
}

/**
 * Restore PostgreSQL database
 */
async function restorePostgresBackup(backupPath: string, config: BackupConfig): Promise<void> {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL not provided for PostgreSQL restore');
  }

  const url = new URL(config.databaseUrl);
  const dbName = url.pathname.slice(1);
  const tempDbName = `${dbName}_restore_temp`;

  const env = { ...process.env, PGPASSWORD: url.password };

  // Create temp database
  const createCmd = `psql -h ${url.hostname} -p ${url.port || '5432'} -U ${url.username} -d postgres -c "CREATE DATABASE \\"${tempDbName}\\";"`;
  await execAsync(createCmd, { env });

  // Restore to temp database
  const restoreCmd = `pg_restore -h ${url.hostname} -p ${url.port || '5432'} -U ${url.username} -d "${tempDbName}" "${backupPath}"`;
  await execAsync(restoreCmd, { env });

  // Swap databases
  const swapCmd = `psql -h ${url.hostname} -p ${url.port || '5432'} -U ${url.username} -d postgres -c "
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}';
    ALTER DATABASE \\"${dbName}\\" RENAME TO \\"${dbName}_old\\";
    ALTER DATABASE \\"${tempDbName}\\" RENAME TO \\"${dbName}\\";
    DROP DATABASE IF EXISTS \\"${dbName}_old\\";
  "`;
  await execAsync(swapCmd, { env });
}

/**
 * Verify backup integrity
 */
export async function verifyBackup(backupPath: string): Promise<boolean> {
  try {
    if (!fs.existsSync(backupPath)) {
      logger.error('Backup file not found');
      return false;
    }

    // Check file size
    const stats = fs.statSync(backupPath);
    if (stats.size === 0) {
      logger.error('Backup file is empty');
      return false;
    }

    // Check gzip integrity if compressed
    if (backupPath.endsWith('.gz')) {
      try {
        await execAsync(`gunzip -t "${backupPath}"`);
      } catch {
        logger.error('Gzip integrity check failed');
        return false;
      }
    }

    // Check metadata if available
    const metadataPath = backupPath.replace(/\.gz$/, '').replace(/\.sql$/, '.json')
      .replace('starpath_backup_', 'metadata_');

    if (fs.existsSync(metadataPath)) {
      const metadata: BackupMetadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
      const actualChecksum = calculateChecksum(backupPath);

      if (metadata.checksum !== actualChecksum) {
        logger.error('Checksum mismatch - file may be corrupted');
        return false;
      }
    }

    return true;
  } catch (error) {
    logger.error({ error }, 'Verification error');
    return false;
  }
}

/**
 * List available backups
 */
export async function listBackups(backupDir?: string): Promise<BackupMetadata[]> {
  const dir = backupDir || defaultBackupConfig.backupDir;

  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = fs.readdirSync(dir);
  const metadataFiles = files.filter(f => f.startsWith('metadata_') && f.endsWith('.json'));

  return metadataFiles
    .map(file => {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        return JSON.parse(content) as BackupMetadata;
      } catch {
        return null;
      }
    })
    .filter((m): m is BackupMetadata => m !== null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Clean up old backups based on retention policy
 */
export async function cleanupOldBackups(config?: Partial<BackupConfig>): Promise<number> {
  const settings = { ...defaultBackupConfig, ...config };
  const retentionDays = settings.retentionDays;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;

  if (!fs.existsSync(settings.backupDir)) {
    return 0;
  }

  const files = fs.readdirSync(settings.backupDir);

  for (const file of files) {
    if (file.startsWith('starpath_backup_')) {
      const filePath = path.join(settings.backupDir, file);
      const stats = fs.statSync(filePath);

      if (stats.mtime < cutoffDate) {
        fs.unlinkSync(filePath);
        deletedCount++;

        // Also delete associated metadata
        const metadataFile = file.replace('starpath_backup_', 'metadata_').replace('.gz', '.json');
        const metadataPath = path.join(settings.backupDir, metadataFile);
        if (fs.existsSync(metadataPath)) {
          fs.unlinkSync(metadataPath);
        }
      }
    }
  }

  logger.info({ deletedCount }, `Cleaned up ${deletedCount} old backups`);
  return deletedCount;
}
