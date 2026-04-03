import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

import ReceptionRequestSchemaRaw from '../../entities/ReceptionRequest.db?raw';
import AssemblyOrderSchemaRaw from '../../entities/AssemblyOrder.db?raw';
import InventorySchemaRaw from '../../entities/Inventory.db?raw';
import ProductSchemaRaw from '../../entities/Product.db?raw';
import ActionLogSchemaRaw from '../../entities/ActionLog.db?raw';

const ReceptionRequestSchema = JSON.parse(ReceptionRequestSchemaRaw);
const AssemblyOrderSchema = JSON.parse(AssemblyOrderSchemaRaw);
const InventorySchema = JSON.parse(InventorySchemaRaw);
const ProductSchema = JSON.parse(ProductSchemaRaw);
const ActionLogSchema = JSON.parse(ActionLogSchemaRaw);

const STORAGE_DB_KEY = 'wms_sqlite_db';
const STORAGE_USER_KEY = 'wms_sqlite_user';

const ENTITY_SCHEMAS = {
  ReceptionRequest: ReceptionRequestSchema,
  AssemblyOrder: AssemblyOrderSchema,
  Inventory: InventorySchema,
  Product: ProductSchema,
  ActionLog: ActionLogSchema,
  User: {
    name: 'User',
    type: 'object',
    properties: {
      email: { type: 'string' },
      full_name: { type: 'string' },
      role: { type: 'string' },
      company_name: { type: 'string' }
    },
    required: ['email', 'role']
  }
};

let SqlJs;
let db;
let initDbPromise;

const sqlType = (schemaType) => {
  if (schemaType === 'number') return 'REAL';
  if (schemaType === 'boolean') return 'INTEGER';
  // arrays and objects serialized to JSON
  if (schemaType === 'array' || schemaType === 'object') return 'TEXT';
  return 'TEXT';
};

const encode = (data) => btoa(String.fromCharCode(...data));
const decode = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

const getTimestamp = () => new Date().toISOString();

const inferValue = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
};

const parseRecord = (row, schema) => {
  const result = { ...row };
  for (const [key, prop] of Object.entries(schema.properties || {})) {
    if (prop.type === 'object' || prop.type === 'array') {
      try {
        result[key] = row[key] ? JSON.parse(row[key]) : row[key];
      } catch (err) {
        result[key] = row[key];
      }
    }
  }
  return result;
};

const getOrderClause = (orderBy) => {
  if (!orderBy) return '';
  const direction = orderBy.startsWith('-') ? 'DESC' : 'ASC';
  const col = orderBy.replace(/^-/, '');
  return `ORDER BY ${col} ${direction}`;
};

const getDb = async () => {
  if (db) return db;
  if (!initDbPromise) {
    initDbPromise = (async () => {
      SqlJs = await initSqlJs({ locateFile: () => wasmUrl });
      const saved = localStorage.getItem(STORAGE_DB_KEY);
      db = saved ? new SqlJs.Database(decode(saved)) : new SqlJs.Database();

      // ensure tables exist
      for (const schema of Object.values(ENTITY_SCHEMAS)) {
        const table = schema.name;
        const exists = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`);
        if (exists.length === 0) {
          const columns = ['id INTEGER PRIMARY KEY AUTOINCREMENT'];
          for (const [field, prop] of Object.entries(schema.properties || {})) {
            columns.push(`"${field}" ${sqlType(prop.type)}`);
          }
          columns.push('created_date TEXT', 'updated_date TEXT');
          db.run(`CREATE TABLE "${table}" (${columns.join(', ')})`);
        }
      }
      return db;
    })();
  }
  return initDbPromise;
};

const saveDb = () => {
  if (!db) return;
  localStorage.setItem(STORAGE_DB_KEY, encode(db.export()));
};

const toObjects = (queryResult, schema) => {
  if (!queryResult || queryResult.length === 0) return [];
  const { columns, values } = queryResult[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return parseRecord(obj, schema);
  });
};

const executeList = async (entity, orderBy = '-created_date', limit = 200) => {
  const db = await getDb();
  const schema = ENTITY_SCHEMAS[entity];
  const order = getOrderClause(orderBy);
  const limitSql = limit ? `LIMIT ${Number(limit)}` : '';
  const result = db.exec(`SELECT * FROM "${entity}" ${order} ${limitSql}`);
  return toObjects(result, schema);
};

const executeFilter = async (entity, filter = {}, orderBy = '-created_date', limit = 200) => {
  const db = await getDb();
  const schema = ENTITY_SCHEMAS[entity];
  let where = '';
  const values = [];
  if (filter && Object.keys(filter).length > 0) {
    const conditions = Object.entries(filter).map(([k, v]) => {
      values.push(inferValue(v));
      return `"${k}" = ?`;
    });
    where = `WHERE ${conditions.join(' AND ')}`;
  }
  const order = getOrderClause(orderBy);
  const limitSql = limit ? `LIMIT ${Number(limit)}` : '';
  const stmt = db.prepare(`SELECT * FROM "${entity}" ${where} ${order} ${limitSql}`);
  stmt.bind(values);
  const result = { columns: [], values: [] };
  while (stmt.step()) {
    if (!result.columns.length) result.columns = stmt.getColumnNames();
    result.values.push(stmt.get());
  }
  stmt.free();
  const rows = result.values.map((rowArray) => {
    const row = {};
    result.columns.forEach((col, idx) => {
      row[col] = rowArray[idx];
    });
    return parseRecord(row, schema);
  });
  return rows;
};

const executeCreate = async (entity, record) => {
  const db = await getDb();
  const now = getTimestamp();
  const schema = ENTITY_SCHEMAS[entity];
  const payload = { ...record };
  Object.entries(payload).forEach(([k, v]) => { payload[k] = inferValue(v); });

  const columns = [...Object.keys(payload), 'created_date', 'updated_date'];
  const placeholders = columns.map(() => '?');
  const values = [...Object.values(payload), now, now];

  const stmt = db.prepare(`INSERT INTO "${entity}" (${columns.map(c => '"' + c + '"').join(', ')}) VALUES (${placeholders.join(', ')})`);
  stmt.bind(values);
  stmt.step();
  stmt.free();

  const lastId = db.exec('SELECT last_insert_rowid() AS id')[0]?.values?.[0]?.[0];
  saveDb();
  return executeGetById(entity, lastId);
};

const executeUpdate = async (entity, id, updates) => {
  const db = await getDb();
  const now = getTimestamp();
  const payload = { ...updates };
  Object.entries(payload).forEach(([k, v]) => { payload[k] = inferValue(v); });

  const setClauses = Object.keys(payload).map((k) => `"${k}" = ?`).join(', ');
  const values = [...Object.values(payload), now, id];

  const stmt = db.prepare(`UPDATE "${entity}" SET ${setClauses}, updated_date = ? WHERE id = ?`);
  stmt.bind(values);
  stmt.step();
  stmt.free();

  saveDb();
  return executeGetById(entity, id);
};

const executeDelete = async (entity, id) => {
  const db = await getDb();
  const stmt = db.prepare(`DELETE FROM "${entity}" WHERE id = ?`);
  stmt.bind([id]);
  stmt.step();
  stmt.free();
  saveDb();
  return true;
};

const executeGetById = async (entity, id) => {
  const db = await getDb();
  const schema = ENTITY_SCHEMAS[entity];
  const stmt = db.prepare(`SELECT * FROM "${entity}" WHERE id = ?`);
  stmt.bind([id]);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row ? parseRecord(row, schema) : null;
};

const getOrCreateCurrentUser = async () => {
  const saved = localStorage.getItem(STORAGE_USER_KEY);
  if (saved) {
    return JSON.parse(saved);
  }

  const users = await executeList('User', '-created_date', 1);
  if (users.length > 0) {
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(users[0]));
    return users[0];
  }

  // create default admin user if no users exist
  const admin = await executeCreate('User', {
    email: 'admin@example.com',
    full_name: 'Администратор',
    role: 'admin',
    company_name: 'Владелец'
  });
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(admin));
  return admin;
};

export const base44 = {
  entities: {
    ReceptionRequest: { list: async (o, l) => executeList('ReceptionRequest', o, l), filter: async (f, o, l) => executeFilter('ReceptionRequest', f, o, l), create: async (d) => executeCreate('ReceptionRequest', d), update: async (i, d) => executeUpdate('ReceptionRequest', i, d), delete: async (i) => executeDelete('ReceptionRequest', i) },
    AssemblyOrder: { list: async (o, l) => executeList('AssemblyOrder', o, l), filter: async (f, o, l) => executeFilter('AssemblyOrder', f, o, l), create: async (d) => executeCreate('AssemblyOrder', d), update: async (i, d) => executeUpdate('AssemblyOrder', i, d), delete: async (i) => executeDelete('AssemblyOrder', i) },
    Inventory: { list: async (o, l) => executeList('Inventory', o, l), filter: async (f, o, l) => executeFilter('Inventory', f, o, l), create: async (d) => executeCreate('Inventory', d), update: async (i, d) => executeUpdate('Inventory', i, d), delete: async (i) => executeDelete('Inventory', i) },
    Product: { list: async (o, l) => executeList('Product', o, l), filter: async (f, o, l) => executeFilter('Product', f, o, l), create: async (d) => executeCreate('Product', d), update: async (i, d) => executeUpdate('Product', i, d), delete: async (i) => executeDelete('Product', i) },
    ActionLog: { list: async (o, l) => executeList('ActionLog', o, l), filter: async (f, o, l) => executeFilter('ActionLog', f, o, l), create: async (d) => executeCreate('ActionLog', d), update: async (i, d) => executeUpdate('ActionLog', i, d), delete: async (i) => executeDelete('ActionLog', i) },
    User: { list: async (o, l) => executeList('User', o, l), filter: async (f, o, l) => executeFilter('User', f, o, l), create: async (d) => executeCreate('User', d), update: async (i, d) => executeUpdate('User', i, d), delete: async (i) => executeDelete('User', i) }
  },
  users: {
    inviteUser: async (email, role) => {
      const existing = await executeFilter('User', { email: email.toLowerCase() }, '-created_date', 1);
      if (existing.length > 0) {
        const user = existing[0];
        return await executeUpdate('User', user.id, { role });
      }
      const user = await executeCreate('User', {
        email: email.toLowerCase(),
        full_name: email.split('@')[0],
        role,
        company_name: ''
      });
      return user;
    }
  },
  auth: {
    me: async () => {
      const user = await getOrCreateCurrentUser();
      return user;
    },
    logout: () => {
      localStorage.removeItem(STORAGE_USER_KEY);
    },
    redirectToLogin: () => {
      window.location.reload();
    }
  }
};

