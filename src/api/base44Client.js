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
const STORAGE_DATA_WIPED_KEY = 'wms_sqlite_data_wiped_v1';
const STORAGE_ALEX_REQUESTS_CLEANED_KEY = 'wms_sqlite_alex_requests_cleaned_v1';
const STORAGE_FULL_DATA_RESET_KEY = 'wms_sqlite_full_data_reset_v2';

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
      username: { type: 'string' },
      email: { type: 'string' },
      password: { type: 'string' },
      full_name: { type: 'string' },
      role: { type: 'string' },
      company_name: { type: 'string' },
      is_active: { type: 'boolean' },
      client_id: { type: 'string' }
    },
    required: ['username', 'password', 'role']
  }
};

let SqlJs;
let sqliteDb;
let initPromise;

const ensureUserTableAndSeed = (db) => {
  db.run(`
    CREATE TABLE IF NOT EXISTS "User" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      "username" TEXT,
      "email" TEXT,
      "password" TEXT,
      "full_name" TEXT,
      "role" TEXT,
      "company_name" TEXT,
      "is_active" INTEGER,
      "client_id" TEXT,
      "created_date" TEXT DEFAULT CURRENT_TIMESTAMP,
      "updated_date" TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const userExists = db.exec('SELECT COUNT(*) as cnt FROM "User"');
  const userCount = userExists[0]?.values[0]?.[0] || 0;

  if (userCount === 0) {
    const now = getTimestamp();
    db.run(
      `INSERT INTO "User" (username, email, password, full_name, role, company_name, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['admin', 'admin@local.dev', 'admin123', 'Administrator', 'admin', 'Local WMS', 1, now, now]
    );
  }
};

const sqlType = (schemaType) => {
  if (schemaType === 'number') return 'REAL';
  if (schemaType === 'boolean') return 'INTEGER';
  if (schemaType === 'array' || schemaType === 'object') return 'TEXT';
  return 'TEXT';
};

const encode = (data) => btoa(String.fromCharCode(...data));
const decode = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));

const getTimestamp = () => new Date().toISOString();

const isMissingUserTableError = (error) =>
  String(error?.message || error).toLowerCase().includes('no such table: user');

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
    } else if (prop.type === 'boolean') {
      // Преобразуем числовые значения в булевы, сохраняя null/undefined как undefined
      if (row[key] === null || row[key] === undefined) {
        result[key] = undefined;
      } else {
        result[key] = Boolean(row[key]);
      }
    }
  }
  return result;
};

const getOrderClause = (orderBy) => {
  if (!orderBy) return '';
  const direction = orderBy.startsWith('-') ? 'DESC' : 'ASC';
  const col = orderBy.replace(/^-/, '');
  return `ORDER BY "${col}" ${direction}`;
};

const initializeDb = async () => {
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      SqlJs = await initSqlJs({ locateFile: () => wasmUrl });
      
      const saved = localStorage.getItem(STORAGE_DB_KEY);
      sqliteDb = saved ? new SqlJs.Database(decode(saved)) : new SqlJs.Database();

      // Create tables and migrate schema if needed
      for (const schema of Object.values(ENTITY_SCHEMAS)) {
        const table = schema.name;
        const exists = sqliteDb.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`);
        const desiredColumns = [];

        for (const [field, prop] of Object.entries(schema.properties || {})) {
          desiredColumns.push({ field, type: sqlType(prop.type) });
        }
        desiredColumns.push({ field: 'created_date', type: 'TEXT DEFAULT CURRENT_TIMESTAMP' });
        desiredColumns.push({ field: 'updated_date', type: 'TEXT DEFAULT CURRENT_TIMESTAMP' });

        if (exists.length === 0) {
          const columns = ['id INTEGER PRIMARY KEY AUTOINCREMENT'];
          for (const col of desiredColumns) {
            columns.push(`"${col.field}" ${col.type}`);
          }
          sqliteDb.run(`CREATE TABLE "${table}" (${columns.join(', ')})`);
        } else {
          const info = sqliteDb.exec(`PRAGMA table_info("${table}")`);
          const existingColumns = info.length > 0 ? info[0].values.map((row) => row[1]) : [];

          for (const col of desiredColumns) {
            if (!existingColumns.includes(col.field)) {
              sqliteDb.run(`ALTER TABLE "${table}" ADD COLUMN "${col.field}" ${col.type}`);
            }
          }
        }
      }

      if (!localStorage.getItem(STORAGE_DATA_WIPED_KEY)) {
        for (const table of ['ReceptionRequest', 'AssemblyOrder', 'Inventory', 'Product']) {
          sqliteDb.run(`DELETE FROM "${table}"`);
        }
        saveDb();
        localStorage.setItem(STORAGE_DATA_WIPED_KEY, '1');
      }

      if (!localStorage.getItem(STORAGE_ALEX_REQUESTS_CLEANED_KEY)) {
        const targetEmail = 'alex@gmail.com';
        sqliteDb.run(`DELETE FROM "ReceptionRequest" WHERE "client_email" = ?`, [targetEmail]);
        sqliteDb.run(`DELETE FROM "AssemblyOrder" WHERE "client_email" = ?`, [targetEmail]);
        saveDb();
        localStorage.setItem(STORAGE_ALEX_REQUESTS_CLEANED_KEY, '1');
      }

      if (!localStorage.getItem(STORAGE_FULL_DATA_RESET_KEY)) {
        for (const table of ['ReceptionRequest', 'AssemblyOrder', 'Inventory', 'Product', 'ActionLog']) {
          sqliteDb.run(`DELETE FROM "${table}"`);
        }
        saveDb();
        localStorage.setItem(STORAGE_FULL_DATA_RESET_KEY, '1');
      }
      
      ensureUserTableAndSeed(sqliteDb);
      saveDb();
      
      return sqliteDb;
    } catch (error) {
      console.error('DB initialization failed:', error);
      // Reset state so next operation can retry clean initialization.
      sqliteDb = null;
      initPromise = null;
      throw error;
    }
  })();
  
  return initPromise;
};

const getDb = async () => {
  if (!sqliteDb) {
    await initializeDb();
  }
  try {
    ensureUserTableAndSeed(sqliteDb);
  } catch (error) {
    // Recover from broken persisted DB state in browser storage.
    if (!isMissingUserTableError(error)) {
      throw error;
    }

    console.warn('Detected broken local DB state. Recreating local SQLite storage.', error);
    localStorage.removeItem(STORAGE_DB_KEY);
    sqliteDb = null;
    initPromise = null;

    await initializeDb();
    ensureUserTableAndSeed(sqliteDb);
  }
  return sqliteDb;
};

const saveDb = () => {
  if (!sqliteDb) return;
  try {
    localStorage.setItem(STORAGE_DB_KEY, encode(sqliteDb.export()));
  } catch (error) {
    console.error('DB save failed:', error);
  }
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
  
  Object.entries(payload).forEach(([k, v]) => {
    payload[k] = inferValue(v);
  });

  const columns = [...Object.keys(payload), 'created_date', 'updated_date'];
  const placeholders = columns.map(() => '?');
  const values = [...Object.values(payload), now, now];

  const columnStr = columns.map(c => `"${c}"`).join(', ');
  const stmt = db.prepare(`INSERT INTO "${entity}" (${columnStr}) VALUES (${placeholders.join(', ')})`);
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
  
  Object.entries(payload).forEach(([k, v]) => {
    payload[k] = inferValue(v);
  });

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

// Ensure DB is initialized on module load
initializeDb().catch(err => console.error('Failed to initialize DB:', err));

export const db = {
  initialized: () => !!sqliteDb,
  
  entities: {
    ReceptionRequest: {
      list: (o, l) => executeList('ReceptionRequest', o, l),
      filter: (f, o, l) => executeFilter('ReceptionRequest', f, o, l),
      get: (i) => executeGetById('ReceptionRequest', i),
      create: (d) => executeCreate('ReceptionRequest', d),
      update: (i, d) => executeUpdate('ReceptionRequest', i, d),
      delete: (i) => executeDelete('ReceptionRequest', i)
    },
    AssemblyOrder: {
      list: (o, l) => executeList('AssemblyOrder', o, l),
      filter: (f, o, l) => executeFilter('AssemblyOrder', f, o, l),
      get: (i) => executeGetById('AssemblyOrder', i),
      create: (d) => executeCreate('AssemblyOrder', d),
      update: (i, d) => executeUpdate('AssemblyOrder', i, d),
      delete: (i) => executeDelete('AssemblyOrder', i)
    },
    Inventory: {
      list: (o, l) => executeList('Inventory', o, l),
      filter: (f, o, l) => executeFilter('Inventory', f, o, l),
      get: (i) => executeGetById('Inventory', i),
      create: (d) => executeCreate('Inventory', d),
      update: (i, d) => executeUpdate('Inventory', i, d),
      delete: (i) => executeDelete('Inventory', i)
    },
    Product: {
      list: (o, l) => executeList('Product', o, l),
      filter: (f, o, l) => executeFilter('Product', f, o, l),
      get: (i) => executeGetById('Product', i),
      create: (d) => executeCreate('Product', d),
      update: (i, d) => executeUpdate('Product', i, d),
      delete: (i) => executeDelete('Product', i)
    },
    ActionLog: {
      list: (o, l) => executeList('ActionLog', o, l),
      filter: (f, o, l) => executeFilter('ActionLog', f, o, l),
      get: (i) => executeGetById('ActionLog', i),
      create: (d) => executeCreate('ActionLog', d),
      update: (i, d) => executeUpdate('ActionLog', i, d),
      delete: (i) => executeDelete('ActionLog', i)
    },
    User: {
      list: (o, l) => executeList('User', o, l),
      filter: (f, o, l) => executeFilter('User', f, o, l),
      get: (i) => executeGetById('User', i),
      create: (d) => executeCreate('User', d),
      update: (i, d) => executeUpdate('User', i, d),
      delete: (i) => executeDelete('User', i)
    }
  },
  
  users: {
    inviteUser: async (email, role) => {
      const normalizedRole = role === 'user' ? 'client' : role;
      const existing = await executeFilter('User', { email: email.toLowerCase() }, '-created_date', 1);
      if (existing.length > 0) {
        const user = existing[0];
        return await executeUpdate('User', user.id, { role: normalizedRole });
      }
      const user = await executeCreate('User', {
        email: email.toLowerCase(),
        full_name: email.split('@')[0],
        role: normalizedRole,
        company_name: ''
      });
      return user;
    }
  },
  
  auth: {
    login: async (username, password) => {
      let users;
      try {
        users = await executeFilter('User', { username: username.toLowerCase() }, '-created_date', 1);
      } catch (error) {
        if (!isMissingUserTableError(error)) {
          throw error;
        }

        console.warn('User table missing during login. Rebuilding local DB and retrying once.');
        localStorage.removeItem(STORAGE_DB_KEY);
        sqliteDb = null;
        initPromise = null;
        await initializeDb();
        users = await executeFilter('User', { username: username.toLowerCase() }, '-created_date', 1);
      }

      if (users.length === 0) {
        throw new Error('Пользователь не найден');
      }
      const user = users[0];
      if (user.password !== password) {
        throw new Error('Неверный пароль');
      }
      // Проверяем, активен ли пользователь
      if (user.is_active === false) {
        throw new Error('Аккаунт заблокирован. Обратитесь к администратору.');
      }
      const userData = { ...user };
      delete userData.password;
      if (userData.role === 'user') userData.role = 'client';
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData));
      return userData;
    },
    
    register: async (username, email, password, fullName, companyName = '', role = 'client') => {
      const normalizedRole = role === 'user' ? 'client' : role;
      const existing = await executeFilter('User', { username: username.toLowerCase() }, '-created_date', 1);
      if (existing.length > 0) {
        throw new Error('Пользователь с таким именем уже существует');
      }
      const user = await executeCreate('User', {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password: password,
        full_name: fullName,
        role: normalizedRole,
        company_name: companyName,
        is_active: false // По умолчанию пользователь неактивен
      });
      const userData = { ...user };
      delete userData.password;
      if (userData.role === 'user') userData.role = 'client';
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData));
      return userData;
    },
    
    me: async () => {
      const saved = localStorage.getItem(STORAGE_USER_KEY);
      if (saved) {
        const user = JSON.parse(saved);
        if (user.role === 'user') user.role = 'client';
        return user;
      }
      return null;
    },
    
    logout: () => {
      localStorage.removeItem(STORAGE_USER_KEY);
    },
    
    redirectToLogin: () => {
      window.location.reload();
    }
  }
};


