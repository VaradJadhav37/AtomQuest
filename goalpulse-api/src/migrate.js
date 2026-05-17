// src/migrate.js — Run schema against Supabase
require('dotenv').config();
const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function migrate() {
  console.log('🔧 Running migrations against Supabase...');
  const sql = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('✅ Schema applied successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

migrate().catch(() => process.exit(1));
