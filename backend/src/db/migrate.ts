import fs from 'fs';
import path from 'path';

/**
 * Reads and returns all migration SQL files in order.
 * Can be used with any PostgreSQL client (pg, knex, etc.)
 */
export function getMigrationFiles(): { name: string; sql: string }[] {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(name => ({
    name,
    sql: fs.readFileSync(path.join(migrationsDir, name), 'utf-8'),
  }));
}

/**
 * Reads and returns all seed SQL files in order.
 */
export function getSeedFiles(): { name: string; sql: string }[] {
  const seedsDir = path.join(__dirname, 'seeds');
  const files = fs.readdirSync(seedsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(name => ({
    name,
    sql: fs.readFileSync(path.join(seedsDir, name), 'utf-8'),
  }));
}

/**
 * Returns the full migration SQL (enums + tables + indexes) as a single string.
 * Useful for test setup or one-shot database initialization.
 */
export function getFullMigrationSQL(): string {
  return getMigrationFiles().map(f => f.sql).join('\n\n');
}

/**
 * Returns the full seed SQL as a single string.
 */
export function getFullSeedSQL(): string {
  return getSeedFiles().map(f => f.sql).join('\n\n');
}
