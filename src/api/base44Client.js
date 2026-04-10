import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabaseClient";

const STORAGE_USER_KEY = "wms_supabase_user";

const ENTITY_TO_TABLE = {
  ReceptionRequest: "reception_requests",
  AssemblyOrder: "assembly_orders",
  Inventory: "inventory",
  Product: "products",
  ActionLog: "action_logs",
  User: "users",
};

const nowIso = () => new Date().toISOString();

const getOrderConfig = (orderBy = "-created_date") => {
  if (!orderBy) return { column: "created_date", ascending: false };
  return {
    column: orderBy.replace(/^-/, ""),
    ascending: !orderBy.startsWith("-"),
  };
};

const assertConfigured = () => {
  if (isSupabaseConfigured()) return;
  throw new Error(
    "Supabase не настроен. Создайте .env.local и добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY"
  );
};

const normalizeRole = (role) => (role === "user" ? "client" : role);

const executeList = async (entity, orderBy = "-created_date", limit = 200) => {
  assertConfigured();
  const supabase = getSupabaseClient();
  const table = ENTITY_TO_TABLE[entity];
  const { column, ascending } = getOrderConfig(orderBy);

  let query = supabase.from(table).select("*").order(column, { ascending });
  if (limit) query = query.limit(Number(limit));

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

const executeFilter = async (entity, filter = {}, orderBy = "-created_date", limit = 200) => {
  assertConfigured();
  const supabase = getSupabaseClient();
  const table = ENTITY_TO_TABLE[entity];
  const { column, ascending } = getOrderConfig(orderBy);

  let query = supabase.from(table).select("*");

  Object.entries(filter || {}).forEach(([key, value]) => {
    query = query.eq(key, value);
  });

  query = query.order(column, { ascending });
  if (limit) query = query.limit(Number(limit));

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

const executeCreate = async (entity, record) => {
  assertConfigured();
  const supabase = getSupabaseClient();
  const table = ENTITY_TO_TABLE[entity];
  const timestamp = nowIso();

  const payload = {
    ...record,
    created_date: record.created_date || timestamp,
    updated_date: timestamp,
  };

  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
};

const executeUpdate = async (entity, id, updates) => {
  assertConfigured();
  const supabase = getSupabaseClient();
  const table = ENTITY_TO_TABLE[entity];

  const { data, error } = await supabase
    .from(table)
    .update({ ...updates, updated_date: nowIso() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

const executeDelete = async (entity, id) => {
  assertConfigured();
  const supabase = getSupabaseClient();
  const table = ENTITY_TO_TABLE[entity];

  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
  return true;
};

const executeGetById = async (entity, id) => {
  assertConfigured();
  const supabase = getSupabaseClient();
  const table = ENTITY_TO_TABLE[entity];

  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data || null;
};

export const db = {
  initialized: () => isSupabaseConfigured(),

  entities: {
    ReceptionRequest: {
      list: (o, l) => executeList("ReceptionRequest", o, l),
      filter: (f, o, l) => executeFilter("ReceptionRequest", f, o, l),
      get: (i) => executeGetById("ReceptionRequest", i),
      create: (d) => executeCreate("ReceptionRequest", d),
      update: (i, d) => executeUpdate("ReceptionRequest", i, d),
      delete: (i) => executeDelete("ReceptionRequest", i),
    },
    AssemblyOrder: {
      list: (o, l) => executeList("AssemblyOrder", o, l),
      filter: (f, o, l) => executeFilter("AssemblyOrder", f, o, l),
      get: (i) => executeGetById("AssemblyOrder", i),
      create: (d) => executeCreate("AssemblyOrder", d),
      update: (i, d) => executeUpdate("AssemblyOrder", i, d),
      delete: (i) => executeDelete("AssemblyOrder", i),
    },
    Inventory: {
      list: (o, l) => executeList("Inventory", o, l),
      filter: (f, o, l) => executeFilter("Inventory", f, o, l),
      get: (i) => executeGetById("Inventory", i),
      create: (d) => executeCreate("Inventory", d),
      update: (i, d) => executeUpdate("Inventory", i, d),
      delete: (i) => executeDelete("Inventory", i),
    },
    Product: {
      list: (o, l) => executeList("Product", o, l),
      filter: (f, o, l) => executeFilter("Product", f, o, l),
      get: (i) => executeGetById("Product", i),
      create: (d) => executeCreate("Product", d),
      update: (i, d) => executeUpdate("Product", i, d),
      delete: (i) => executeDelete("Product", i),
    },
    ActionLog: {
      list: (o, l) => executeList("ActionLog", o, l),
      filter: (f, o, l) => executeFilter("ActionLog", f, o, l),
      get: (i) => executeGetById("ActionLog", i),
      create: (d) => executeCreate("ActionLog", d),
      update: (i, d) => executeUpdate("ActionLog", i, d),
      delete: (i) => executeDelete("ActionLog", i),
    },
    User: {
      list: (o, l) => executeList("User", o, l),
      filter: (f, o, l) => executeFilter("User", f, o, l),
      get: (i) => executeGetById("User", i),
      create: (d) => executeCreate("User", d),
      update: (i, d) => executeUpdate("User", i, d),
      delete: (i) => executeDelete("User", i),
    },
  },

  users: {
    inviteUser: async (email, role) => {
      const normalizedRole = normalizeRole(role);
      const existing = await executeFilter("User", { email: email.toLowerCase() }, "-created_date", 1);
      if (existing.length > 0) {
        return executeUpdate("User", existing[0].id, { role: normalizedRole });
      }

      return executeCreate("User", {
        username: email.split("@")[0].toLowerCase(),
        email: email.toLowerCase(),
        password: "",
        full_name: email.split("@")[0],
        role: normalizedRole,
        company_name: "",
        is_active: false,
      });
    },
  },

  auth: {
    login: async (username, password) => {
      const users = await executeFilter("User", { username: username.toLowerCase() }, "-created_date", 1);
      if (users.length === 0) {
        throw new Error("Пользователь не найден");
      }

      const user = users[0];
      if (user.password !== password) {
        throw new Error("Неверный пароль");
      }

      if (user.is_active === false) {
        throw new Error("Аккаунт заблокирован. Обратитесь к администратору.");
      }

      const userData = { ...user, role: normalizeRole(user.role) };
      delete userData.password;
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData));
      return userData;
    },

    register: async (username, email, password, fullName, companyName = "", role = "client") => {
      const existing = await executeFilter("User", { username: username.toLowerCase() }, "-created_date", 1);
      if (existing.length > 0) {
        throw new Error("Пользователь с таким именем уже существует");
      }

      const user = await executeCreate("User", {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password,
        full_name: fullName,
        role: normalizeRole(role),
        company_name: companyName,
        is_active: false,
      });

      const userData = { ...user, role: normalizeRole(user.role) };
      delete userData.password;
      localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userData));
      return userData;
    },

    me: async () => {
      const saved = localStorage.getItem(STORAGE_USER_KEY);
      if (!saved) return null;
      const user = JSON.parse(saved);
      user.role = normalizeRole(user.role);
      return user;
    },

    logout: () => {
      localStorage.removeItem(STORAGE_USER_KEY);
    },

    redirectToLogin: () => {
      window.location.reload();
    },
  },

  adminDeductInventory: async (clientEmail, productName, quantity = 290) => {
    const allInventory = await executeFilter("Inventory", { client_email: clientEmail }, "-updated_date", 500);
    if (allInventory.length === 0) {
      throw new Error(`У клиента ${clientEmail} нет товаров в инвентаре`);
    }

    const item = allInventory.find(
      (i) => i.product_name && i.product_name.toLowerCase().includes(productName.toLowerCase())
    );

    if (!item) {
      throw new Error(`Товар \"${productName}\" не найден`);
    }

    const newQuantity = Math.max(0, Number(item.quantity || 0) - quantity);
    const newReserved = Math.max(0, Number(item.reserved || 0) - quantity);

    await executeUpdate("Inventory", item.id, {
      quantity: newQuantity,
      reserved: newReserved,
    });

    await executeCreate("ActionLog", {
      user_email: "admin@local.dev",
      user_name: "Система",
      action: "Ручное списание товара",
      entity_type: "Inventory",
      entity_id: String(item.id),
      details: `${item.product_name} SKU ${item.sku}: списано ${quantity} ед. для ${clientEmail}`,
    });

    return {
      success: true,
      product: item.product_name,
      deducted: quantity,
      newQuantity,
      newReserved,
    };
  },
};

if (typeof window !== "undefined") {
  window.db = db;
}
