/**
 * Script de setup: corre migraciones + seeds contra la base de datos.
 *
 * Uso: npx ts-node src/db/setup.ts
 */

import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { getMigrationFiles, getSeedFiles } from './migrate';

const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'biosur',
  user: process.env.PGUSER || 'biosur',
  password: process.env.PGPASSWORD || 'biosur',
});

// Valid hex UUIDs for seed data
const ID = {
  admin:      'aa000000-0000-4000-a000-000000000001',
  conductor1: 'cc000000-0000-4000-a000-000000000001',
  conductor2: 'cc000000-0000-4000-a000-000000000002',
  mant1:      'ee000000-0000-4000-a000-000000000001',
  mant2:      'ee000000-0000-4000-a000-000000000002',
  unidad1:    'dd000000-0000-4000-a000-000000000001',
  unidad2:    'dd000000-0000-4000-a000-000000000002',
  unidad3:    'dd000000-0000-4000-a000-000000000003',
  unidad4:    'dd000000-0000-4000-a000-000000000004',
  unidad5:    'dd000000-0000-4000-a000-000000000005',
};

async function setup() {
  const client = await pool.connect();

  try {
    console.log('🔧 Corriendo migraciones...\n');

    const migrations = getMigrationFiles();
    for (const migration of migrations) {
      console.log(`  ✓ ${migration.name}`);
      await client.query(migration.sql);
    }

    console.log('\n🌱 Corriendo seeds...\n');

    const seeds = getSeedFiles();
    for (const seed of seeds) {
      if (seed.name === '002_usuarios_prueba.sql') continue;
      console.log(`  ✓ ${seed.name}`);
      await client.query(seed.sql);
    }

    console.log('  ✓ Creando usuarios de prueba...');
    const passwordHash = await bcrypt.hash('biosur123', 10);

    const usuarios = [
      [ID.admin,      'admin@biosur.cl',      'administrador',         'Carlos Mendoza'],
      [ID.conductor1, 'conductor1@biosur.cl',  'conductor',             'Juan Pérez'],
      [ID.conductor2, 'conductor2@biosur.cl',  'conductor',             'María González'],
      [ID.mant1,      'mant1@biosur.cl',       'equipo_mantenimiento',  'Roberto Silva'],
      [ID.mant2,      'mant2@biosur.cl',       'equipo_mantenimiento',  'Ana Torres'],
    ];

    for (const [id, email, rol, nombre] of usuarios) {
      await client.query(
        `INSERT INTO usuario (id, email, password_hash, rol, nombre, activo)
         VALUES ($1, $2, $3, $4, $5, true)
         ON CONFLICT (email) DO NOTHING`,
        [id, email, passwordHash, rol, nombre],
      );
    }

    console.log('  ✓ Creando unidades de flota...');
    const unidades: [string, string, string, string, number, string][] = [
      [ID.unidad1, 'Mercedes-Benz', 'Sprinter 516', 'ABCD12', 2022, 'operativa'],
      [ID.unidad2, 'Ford',          'Transit 350',  'EFGH34', 2021, 'operativa'],
      [ID.unidad3, 'Toyota',        'Hilux DX',     'IJKL56', 2023, 'disponible'],
      [ID.unidad4, 'Volkswagen',    'Crafter',      'MNOP78', 2020, 'en_mantenimiento'],
      [ID.unidad5, 'Hyundai',       'HD78',         'QRST90', 2022, 'operativa'],
    ];

    for (const [id, marca, modelo, patente, anio, estado] of unidades) {
      await client.query(
        `INSERT INTO unidad (id, marca, modelo, patente, anio, estado)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (patente) DO NOTHING`,
        [id, marca, modelo, patente, anio, estado],
      );
    }

    console.log('  ✓ Creando asignaciones de conductores para hoy...');
    await client.query(
      `INSERT INTO asignacion_conductor (conductor_id, unidad_id, fecha_jornada)
       VALUES ($1, $2, CURRENT_DATE)
       ON CONFLICT DO NOTHING`,
      [ID.conductor1, ID.unidad1],
    );
    await client.query(
      `INSERT INTO asignacion_conductor (conductor_id, unidad_id, fecha_jornada)
       VALUES ($1, $2, CURRENT_DATE)
       ON CONFLICT DO NOTHING`,
      [ID.conductor2, ID.unidad2],
    );

    console.log('\n✅ Setup completo!\n');
    console.log('Usuarios de prueba (contraseña: biosur123):');
    console.log('  📋 Admin:       admin@biosur.cl');
    console.log('  🚗 Conductor 1: conductor1@biosur.cl  → Mercedes-Benz Sprinter 516 (ABCD12)');
    console.log('  🚗 Conductor 2: conductor2@biosur.cl  → Ford Transit 350 (EFGH34)');
    console.log('  🔧 Mant. 1:     mant1@biosur.cl');
    console.log('  🔧 Mant. 2:     mant2@biosur.cl');
    console.log('');
  } catch (error) {
    console.error('❌ Error durante el setup:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setup();
