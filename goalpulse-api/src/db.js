// src/db.js — Supabase JS client (no direct pg needed)
require('dotenv').config();
const { Agent, setGlobalDispatcher } = require('undici');
const dns = require('dns');

setGlobalDispatcher(new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      if (hostname === 'lrtpvwzppxttmlqabuhu.supabase.co') {
        callback(null, [{ address: '104.18.38.10', family: 4 }]);
      } else {
        dns.lookup(hostname, options, (err, address, family) => {
          if (err) return callback(err);
          callback(null, [{ address, family }]);
        });
      }
    }
  }
}));

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY,
  {
    auth: { persistSession: false },
    db: { schema: 'public' },
  }
);

// ── Helper wrappers to keep route code clean ─────────────────────────────

async function query(table, options = {}) {
  let q = supabase.from(table).select(options.select || '*');
  if (options.eq)  Object.entries(options.eq).forEach(([k, v]) => (q = q.eq(k, v)));
  if (options.neq) Object.entries(options.neq).forEach(([k, v]) => (q = q.neq(k, v)));
  if (options.order) q = q.order(options.order.col, { ascending: options.order.asc ?? true });
  if (options.limit) q = q.limit(options.limit);
  if (options.single) q = q.maybeSingle();
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function insert(table, values, returning = true) {
  const q = returning
    ? supabase.from(table).insert(values).select().single()
    : supabase.from(table).insert(values);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

async function update(table, values, match) {
  let q = supabase.from(table).update(values);
  Object.entries(match).forEach(([k, v]) => (q = q.eq(k, v)));
  const { data, error } = await q.select().single();
  if (error) throw error;
  return data;
}

async function upsert(table, values, onConflict) {
  const { data, error } = await supabase
    .from(table)
    .upsert(values, { onConflict })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function remove(table, match) {
  let q = supabase.from(table).delete();
  Object.entries(match).forEach(([k, v]) => (q = q.eq(k, v)));
  const { error } = await q;
  if (error) throw error;
  return true;
}

// Raw RPC / SQL via Supabase RPC (for complex queries we use rpc or views)
async function rpc(fn, params = {}) {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw error;
  return data;
}

module.exports = { supabase, query, insert, update, upsert, remove, rpc };
