const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { getPool } = require("../config/mysql");

const COLLECTION_TABLE = "mysql_documents";

const clone = (value) => JSON.parse(JSON.stringify(value ?? null));
const nowIso = () => new Date().toISOString();
const cleanPath = (path = "") => String(path).replace(/^\$\.?/, "");

const makeObjectId = () => {
  if (crypto.randomBytes) return crypto.randomBytes(12).toString("hex");
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2, 14)}`.slice(0, 24);
};

const getValue = (obj, path) => {
  const parts = cleanPath(path).split(".").filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) current = current.map((item) => item?.[part]).flat();
    else current = current[part];
  }
  return current;
};

const setValue = (obj, path, value) => {
  const parts = cleanPath(path).split(".").filter(Boolean);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (!current[part] || typeof current[part] !== "object") current[part] = {};
    current = current[part];
  }
  current[parts[parts.length - 1]] = value;
};

const unsetValue = (obj, path) => {
  const parts = cleanPath(path).split(".").filter(Boolean);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i += 1) {
    current = current?.[parts[i]];
    if (!current) return;
  }
  delete current[parts[parts.length - 1]];
};

const valuesEqual = (left, right) => {
  const normalize = (value) => {
    if (value instanceof Date) return value.toISOString();
    if (value && typeof value === "object" && value.toString && value.constructor?.name === "ObjectId") {
      return value.toString();
    }
    if (value && typeof value === "object") {
      return value._id || value.id || value.mongo_id || value.mongoId || JSON.stringify(value);
    }
    return value;
  };
  return String(normalize(left)) === String(normalize(right));
};

const compare = (left, op, right) => {
  if (op === "$in") {
    const list = Array.isArray(right) ? right : [right];
    if (Array.isArray(left)) return left.some((item) => list.some((candidate) => valuesEqual(item, candidate)));
    return list.some((candidate) => valuesEqual(left, candidate));
  }
  if (op === "$ne") return !valuesEqual(left, right);
  if (op === "$exists") return right ? left !== undefined : left === undefined;

  const leftComparable = left instanceof Date ? left.getTime() : new Date(left).toString() !== "Invalid Date" && right instanceof Date ? new Date(left).getTime() : left;
  const rightComparable = right instanceof Date ? right.getTime() : right;

  if (op === "$gt") return leftComparable > rightComparable;
  if (op === "$gte") return leftComparable >= rightComparable;
  if (op === "$lt") return leftComparable < rightComparable;
  if (op === "$lte") return leftComparable <= rightComparable;
  if (op === "$regex") {
    const flags = "";
    const regex = right instanceof RegExp ? right : new RegExp(String(right), flags);
    return regex.test(String(left || ""));
  }
  return false;
};

const matchesValue = (actual, expected) => {
  if (expected instanceof RegExp) return expected.test(String(actual || ""));
  if (expected && typeof expected === "object" && !Array.isArray(expected) && !(expected instanceof Date)) {
    return Object.entries(expected).every(([op, value]) => {
      if (!op.startsWith("$")) return matchesValue(getValue(actual, op), value);
      return compare(actual, op, value);
    });
  }
  if (Array.isArray(actual)) return actual.some((item) => valuesEqual(item, expected));
  return valuesEqual(actual, expected);
};

const matchesFilter = (doc, filter = {}) => {
  if (!filter || !Object.keys(filter).length) return true;

  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") return Array.isArray(expected) && expected.some((item) => matchesFilter(doc, item));
    if (key === "$and") return Array.isArray(expected) && expected.every((item) => matchesFilter(doc, item));
    if (key === "$expr") return true;
    return matchesValue(getValue(doc, key), expected);
  });
};

const applySelect = (doc, select) => {
  if (!doc || !select) return doc;
  const fields = Array.isArray(select) ? select : String(select).split(/\s+/).filter(Boolean);
  if (!fields.length) return doc;

  const include = fields.filter((field) => !field.startsWith("-") && !field.startsWith("+"));
  const exclude = fields.filter((field) => field.startsWith("-")).map((field) => field.slice(1));
  const source = clone(doc);

  if (include.length) {
    const picked = { _id: source._id, id: source.id };
    include.forEach((field) => {
      const key = field.replace(/^\+/, "");
      const value = getValue(source, key);
      if (value !== undefined) setValue(picked, key, value);
    });
    return picked;
  }

  exclude.forEach((field) => unsetValue(source, field));
  return source;
};

const normalizeUpdate = (current, update = {}) => {
  const next = clone(current || {});
  const hasOperator = Object.keys(update).some((key) => key.startsWith("$"));

  if (!hasOperator) {
    Object.entries(update).forEach(([key, value]) => setValue(next, key, value));
    return next;
  }

  Object.entries(update.$set || {}).forEach(([key, value]) => setValue(next, key, value));
  Object.entries(update.$setOnInsert || {}).forEach(([key, value]) => {
    if (getValue(next, key) === undefined) setValue(next, key, value);
  });
  Object.entries(update.$unset || {}).forEach(([key]) => unsetValue(next, key));
  Object.entries(update.$inc || {}).forEach(([key, value]) => {
    setValue(next, key, (Number(getValue(next, key)) || 0) + Number(value || 0));
  });
  Object.entries(update.$push || {}).forEach(([key, value]) => {
    const arr = Array.isArray(getValue(next, key)) ? getValue(next, key) : [];
    arr.push(value);
    setValue(next, key, arr);
  });
  Object.entries(update.$pull || {}).forEach(([key, value]) => {
    const arr = Array.isArray(getValue(next, key)) ? getValue(next, key) : [];
    setValue(next, key, arr.filter((item) => !matchesFilter(item, value)));
  });

  return next;
};

const sortDocs = (docs, sort = {}) => {
  const entries = typeof sort === "string"
    ? sort.split(/\s+/).filter(Boolean).map((field) => [field.replace(/^-/, ""), field.startsWith("-") ? -1 : 1])
    : Object.entries(sort || {});

  if (!entries.length) return docs;

  return [...docs].sort((a, b) => {
    for (const [field, direction] of entries) {
      const av = getValue(a, field);
      const bv = getValue(b, field);
      if (av === bv) continue;
      return av > bv ? Number(direction) : -Number(direction);
    }
    return 0;
  });
};

class MysqlDocument {
  constructor(model, data = {}) {
    Object.defineProperty(this, "__model", { value: model, enumerable: false });
    Object.assign(this, data);
    this._id = String(this._id || this.id || makeObjectId());
    this.id = this._id;
  }

  toObject() {
    const plain = {};
    Object.keys(this).forEach((key) => {
      if (!key.startsWith("__")) plain[key] = this[key];
    });
    return clone(plain);
  }

  toJSON() {
    return this.toObject();
  }

  async save() {
    if (this.__model.modelName === "User" && this.password && !/^\$2[aby]\$\d{2}\$/.test(String(this.password))) {
      this.password = await bcrypt.hash(this.password, 12);
    }
    const saved = await this.__model._savePlain(this.toObject());
    Object.assign(this, saved);
    return this;
  }
}

class MysqlQuery {
  constructor(model, action, filter = {}, options = {}) {
    this.model = model;
    this.action = action;
    this.filter = filter || {};
    this.options = { ...options };
  }

  select(value) { this.options.select = value; return this; }
  populate(value, select = "") {
    const spec = typeof value === "string" && select ? { path: value, select } : value;
    this.options.populate = this.options.populate ? [].concat(this.options.populate, spec) : spec;
    return this;
  }
  lean(value = true) { this.options.lean = value; return this; }
  sort(value) { this.options.sort = value; return this; }
  limit(value) { this.options.limit = Number(value); return this; }
  skip(value) { this.options.skip = Number(value); return this; }
  session() { return this; }
  read() { return this; }
  maxTimeMS(value) { this.options.maxTimeMS = Number(value); return this; }

  async exec() {
    return this.model._execute(this.action, this.filter, this.options);
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }

  catch(reject) {
    return this.exec().catch(reject);
  }
}

class MysqlUpdateQuery {
  constructor(model, filter, update, options = {}) {
    this.model = model;
    this.filter = filter;
    this.update = update;
    this.options = { ...options };
  }

  select(value) { this.options.select = value; return this; }
  lean(value = true) { this.options.lean = value; return this; }
  session() { return this; }
  maxTimeMS(value) { this.options.maxTimeMS = Number(value); return this; }

  async exec() {
    let doc = (await this.model._candidates(this.filter)).find((item) => matchesFilter(item, this.filter));
    if (!doc && this.options.upsert) doc = { _id: makeObjectId() };
    if (!doc) return null;
    const saved = await this.model._savePlain(normalizeUpdate(doc, this.update));
    return this.model._wrap(saved, this.options.lean ? { ...this.options, lean: true } : this.options.select);
  }

  then(resolve, reject) { return this.exec().then(resolve, reject); }
  catch(reject) { return this.exec().catch(reject); }
}

class MysqlExistsQuery {
  constructor(model, filter = {}) {
    this.model = model;
    this.filter = filter || {};
    this.options = {};
  }

  maxTimeMS(value) { this.options.maxTimeMS = Number(value); return this; }
  session() { return this; }
  read() { return this; }

  async exec() {
    const found = await this.model.findOne(this.filter).lean();
    return found ? { _id: found._id } : null;
  }

  then(resolve, reject) { return this.exec().then(resolve, reject); }
  catch(reject) { return this.exec().catch(reject); }
}

const ensureTable = async () => {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS ${COLLECTION_TABLE} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      collection_name VARCHAR(80) NOT NULL,
      mongo_id VARCHAR(24) NOT NULL,
      data JSON NOT NULL,
      doc_email VARCHAR(254) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.email'))) STORED,
      doc_email_lower VARCHAR(254) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.emailLower'))) STORED,
      doc_slug VARCHAR(220) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.slug'))) STORED,
      doc_user_id VARCHAR(24) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.userId'))) STORED,
      doc_status VARCHAR(60) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.status'))) STORED,
      doc_role VARCHAR(40) GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(data, '$.role'))) STORED,
      doc_is_deleted TINYINT(1) GENERATED ALWAYS AS (
        CASE JSON_UNQUOTE(JSON_EXTRACT(data, '$.isDeleted')) WHEN 'true' THEN 1 WHEN '1' THEN 1 ELSE 0 END
      ) STORED,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_mysql_documents_collection_id (collection_name, mongo_id),
      KEY idx_mysql_documents_collection (collection_name),
      KEY idx_mysql_documents_email (collection_name, doc_email),
      KEY idx_mysql_documents_email_lower (collection_name, doc_email_lower),
      KEY idx_mysql_documents_slug (collection_name, doc_slug),
      KEY idx_mysql_documents_user (collection_name, doc_user_id),
      KEY idx_mysql_documents_status (collection_name, doc_status),
      KEY idx_mysql_documents_role_deleted (collection_name, doc_role, doc_is_deleted)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const modelForPath = (path) => {
  if (path.includes("user")) return require("../models/user.model");
  if (path.includes("category")) return require("../models/category.model");
  if (path.includes("product")) return require("../models/product.model");
  if (path.includes("address")) return require("../models/address.model");
  return null;
};

const populateOnePath = async (doc, populateSpec) => {
  if (!doc || !populateSpec) return doc;
  const path = typeof populateSpec === "string" ? populateSpec.split(/\s+/)[0] : populateSpec.path;
  const select = typeof populateSpec === "object" ? populateSpec.select : "";
  if (!path) return doc;

  const Model = modelForPath(path.toLowerCase());
  if (!Model) return doc;

  const populateValue = async (value) => {
    if (!value || typeof value === "object") return value;
    const found = await Model.findById(value).select(select).lean();
    return found || value;
  };

  const parts = path.split(".");
  if (parts.length === 1) {
    setValue(doc, path, await populateValue(getValue(doc, path)));
    return doc;
  }

  const root = getValue(doc, parts[0]);
  if (Array.isArray(root)) {
    for (const row of root) {
      const childPath = parts.slice(1).join(".");
      setValue(row, childPath, await populateValue(getValue(row, childPath)));
    }
  }
  return doc;
};

const populateDocs = async (docs, populateSpec) => {
  const specs = [].concat(populateSpec || []).filter(Boolean);
  if (!specs.length) return docs;
  for (const doc of docs) {
    for (const spec of specs) await populateOnePath(doc, spec);
  }
  return docs;
};

const collectionName = (name) => `${String(name).charAt(0).toLowerCase()}${String(name).slice(1)}s`;

const createMysqlDocumentModel = (name, extensions = {}) => {
  class Model extends MysqlDocument {
    constructor(data = {}) {
      super(Model, data);
    }
  }

  Model.modelName = name;
  Model.collectionName = extensions.collection || collectionName(name);

  Model._all = async () => {
    await ensureTable();
    const [rows] = await getPool().query(
      `SELECT data FROM ${COLLECTION_TABLE} WHERE collection_name = ?`,
      [Model.collectionName]
    );
    return rows.map((row) => (typeof row.data === "string" ? JSON.parse(row.data) : row.data));
  };

  Model._candidates = async (filter = {}) => {
    await ensureTable();

    const clauses = ["collection_name = ?"];
    const params = [Model.collectionName];
    const add = (column, value) => {
      if (value !== undefined && value !== null && typeof value !== "object") {
        clauses.push(`${column} = ?`);
        params.push(String(value));
      }
    };

    add("mongo_id", filter._id);
    add("doc_email", filter.email);
    add("doc_email_lower", filter.emailLower);
    add("doc_slug", filter.slug);
    add("doc_user_id", filter.userId || filter.user);
    add("doc_status", filter.status);
    add("doc_role", filter.role);

    const [rows] = await getPool().query(
      `SELECT data FROM ${COLLECTION_TABLE} WHERE ${clauses.join(" AND ")}`,
      params
    );
    return rows.map((row) => (typeof row.data === "string" ? JSON.parse(row.data) : row.data));
  };

  Model._savePlain = async (data) => {
    await ensureTable();
    const defaults = typeof extensions.defaults === "function"
      ? extensions.defaults()
      : (extensions.defaults || {});
    const doc = { ...clone(defaults), ...clone(data || {}) };
    doc._id = String(doc._id || doc.id || makeObjectId());
    doc.id = doc._id;
    if (doc.isDeleted === undefined) doc.isDeleted = false;
    doc.createdAt = doc.createdAt || nowIso();
    doc.updatedAt = nowIso();

    await getPool().query(
      `INSERT INTO ${COLLECTION_TABLE} (collection_name, mongo_id, data)
       VALUES (?, ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = CURRENT_TIMESTAMP`,
      [Model.collectionName, doc._id, JSON.stringify(doc)]
    );

    return doc;
  };

  Model._wrap = (doc, lean) => {
    if (!doc) return null;
    const select = lean && typeof lean === "object" ? lean.select : lean;
    const selected = applySelect(doc, typeof select === "boolean" ? "" : select);
    return lean === true || lean?.lean ? selected : new Model(selected);
  };

  Model._execute = async (action, filter, options = {}) => {
    let docs = (await Model._candidates(filter)).filter((doc) => matchesFilter(doc, filter));
    docs = sortDocs(docs, options.sort);
    if (Number.isFinite(options.skip) && options.skip > 0) docs = docs.slice(options.skip);
    if (Number.isFinite(options.limit) && options.limit >= 0) docs = docs.slice(0, options.limit);
    docs = await populateDocs(docs.map(clone), options.populate);

    if (action === "findOne") return Model._wrap(docs[0] || null, options.lean ? { ...options, lean: true, select: options.select } : options.select);
    if (action === "find") {
      return docs.map((doc) => Model._wrap(doc, options.lean ? { ...options, lean: true, select: options.select } : options.select));
    }
    return null;
  };

  Model.find = (filter = {}, select = "") => new MysqlQuery(Model, "find", filter, { select });
  Model.findOne = (filter = {}, select = "") => new MysqlQuery(Model, "findOne", filter, { select });
  Model.findById = (id) => Model.findOne({ _id: String(id || "") });
  Model.create = async (data) => {
    if (Array.isArray(data)) {
      const saved = [];
      for (const item of data) saved.push(new Model(await Model._savePlain(item)));
      return saved;
    }
    return new Model(await Model._savePlain(data));
  };
  Model.exists = (filter = {}) => new MysqlExistsQuery(Model, filter);
  Model.countDocuments = async (filter = {}) => (await Model._candidates(filter)).filter((doc) => matchesFilter(doc, filter)).length;
  Model.updateOne = async (filter, update) => {
    const doc = (await Model._candidates(filter)).find((item) => matchesFilter(item, filter));
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };
    await Model._savePlain(normalizeUpdate(doc, update));
    return { matchedCount: 1, modifiedCount: 1 };
  };
  Model.updateMany = async (filter, update) => {
    const docs = (await Model._candidates(filter)).filter((item) => matchesFilter(item, filter));
    for (const doc of docs) await Model._savePlain(normalizeUpdate(doc, update));
    return { matchedCount: docs.length, modifiedCount: docs.length };
  };
  Model.deleteOne = async (filter) => {
    const doc = (await Model._candidates(filter)).find((item) => matchesFilter(item, filter));
    if (!doc) return { deletedCount: 0 };
    await getPool().query(`DELETE FROM ${COLLECTION_TABLE} WHERE collection_name = ? AND mongo_id = ?`, [Model.collectionName, doc._id]);
    return { deletedCount: 1 };
  };
  Model.deleteMany = async (filter) => {
    const docs = (await Model._candidates(filter)).filter((item) => matchesFilter(item, filter));
    for (const doc of docs) await Model.deleteOne({ _id: doc._id });
    return { deletedCount: docs.length };
  };
  Model.findOneAndUpdate = (filter, update, options = {}) => new MysqlUpdateQuery(Model, filter, update, options);
  Model.findByIdAndUpdate = (id, update, options = {}) => Model.findOneAndUpdate({ _id: String(id || "") }, update, options);
  Model.findByIdAndDelete = async (id) => {
    const doc = await Model.findById(id).lean();
    await Model.deleteOne({ _id: String(id || "") });
    return doc;
  };
  Model.paginate = async (filter = {}, options = {}) => {
    const page = Math.max(1, Number(options.page || 1));
    const limit = Math.max(1, Number(options.limit || 20));
    const all = sortDocs((await Model._candidates(filter)).filter((doc) => matchesFilter(doc, filter)), options.sort);
    const docs = all.slice((page - 1) * limit, page * limit).map((doc) => applySelect(doc, options.select));
    return {
      docs,
      totalDocs: all.length,
      limit,
      page,
      totalPages: Math.max(1, Math.ceil(all.length / limit)),
      hasNextPage: page * limit < all.length,
      hasPrevPage: page > 1,
    };
  };
  Model.distinct = async (field, filter = {}) => {
    const docs = (await Model._candidates(filter)).filter((doc) => matchesFilter(doc, filter));
    return [...new Set(docs.flatMap((doc) => {
      const value = getValue(doc, field);
      return Array.isArray(value) ? value : [value];
    }).filter((value) => value !== undefined && value !== null && value !== ""))];
  };
  Model.bulkWrite = async (operations = []) => {
    let modifiedCount = 0;
    let upsertedCount = 0;
    for (const op of operations) {
      if (op.updateOne) {
        const existing = await Model.findOne(op.updateOne.filter).lean();
        await Model.findOneAndUpdate(op.updateOne.filter, op.updateOne.update, {
          upsert: Boolean(op.updateOne.upsert),
          new: true,
        });
        if (existing) modifiedCount += 1;
        else if (op.updateOne.upsert) upsertedCount += 1;
      }
      if (op.insertOne) {
        await Model.create(op.insertOne.document);
        upsertedCount += 1;
      }
      if (op.deleteOne) {
        const result = await Model.deleteOne(op.deleteOne.filter);
        modifiedCount += result.deletedCount || 0;
      }
    }
    return { modifiedCount, upsertedCount };
  };
  Model.aggregate = async (pipeline = []) => {
    let docs = await Model._candidates(pipeline.find((step) => step.$match)?.$match || {});
    for (const step of pipeline) {
      if (step.$match) docs = docs.filter((doc) => matchesFilter(doc, step.$match));
      if (step.$sort) docs = sortDocs(docs, step.$sort);
      if (step.$limit) docs = docs.slice(0, Number(step.$limit));
      if (step.$group) {
        const idExpr = step.$group._id;
        const grouped = new Map();
        docs.forEach((doc) => {
          const key = typeof idExpr === "string" && idExpr.startsWith("$") ? getValue(doc, idExpr.slice(1)) : idExpr;
          const current = grouped.get(String(key)) || { _id: key };
          Object.entries(step.$group).forEach(([field, expr]) => {
            if (field === "_id") return;
            if (expr.$sum !== undefined) current[field] = (current[field] || 0) + (typeof expr.$sum === "string" ? Number(getValue(doc, expr.$sum.slice(1)) || 0) : Number(expr.$sum || 0));
            if (expr.$avg) {
              current.__avg = current.__avg || {};
              current.__avg[field] = current.__avg[field] || { sum: 0, count: 0 };
              current.__avg[field].sum += Number(getValue(doc, expr.$avg.slice(1)) || 0);
              current.__avg[field].count += 1;
              current[field] = current.__avg[field].sum / current.__avg[field].count;
            }
          });
          grouped.set(String(key), current);
        });
        docs = [...grouped.values()].map(({ __avg, ...doc }) => doc);
      }
    }
    return docs;
  };

  Object.assign(Model, extensions.statics || {});
  Object.assign(Model.prototype, extensions.methods || {});

  return Model;
};

module.exports = {
  createMysqlDocumentModel,
  makeObjectId,
  matchesFilter,
  normalizeUpdate,
};
