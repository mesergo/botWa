import mongodb from 'mongodb';
import mongoose from 'mongoose';
import { getSmsDb, isSmsConfigured, isSmsConnected, connectSmsDb } from '../sms-in/smsDb.js';
import { normalizePhone } from './phone.js';
import BotFlow from '../models/BotFlow.js';
import Contact from '../models/Contact.js';

const ObjectID = mongodb.ObjectID || mongodb.ObjectId;
const FBIZ_PREFIX = 'fbiz_';
const CHUNK_SIZE = 500;
const MAX_MONTHS = 24;

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function fbizCollectionName(phone) {
  const digits = digitsOnly(normalizePhone(phone) || phone);
  return digits ? `${FBIZ_PREFIX}${digits}` : '';
}

export function listUserFbizPhones(user) {
  return listUserFbizSources(user).map((source) => source.phone);
}

export function listUserFbizSources(user) {
  const sourcesByPhone = new Map();
  for (const n of user?.connected_numbers || []) {
    const raw = n.display_phone_number || n.phone || '';
    const digits = digitsOnly(normalizePhone(raw) || raw);
    if (!digits || sourcesByPhone.has(digits)) continue;
    sourcesByPhone.set(digits, {
      phone: digits,
      displayPhone: String(raw || digits),
      verifiedName: String(n.verified_name || ''),
      provider: String(n.provider || ''),
      phoneNumberId: String(n.phone_number_id || '')
    });
  }

  // Legacy accounts may predate connected_numbers. Keep the account phone as a
  // fallback only when no connected WhatsApp line exists.
  if (sourcesByPhone.size === 0 && user?.phone) {
    const digits = digitsOnly(normalizePhone(user.phone) || user.phone);
    if (digits) {
      sourcesByPhone.set(digits, {
        phone: digits,
        displayPhone: String(user.phone),
        verifiedName: '',
        provider: '',
        phoneNumberId: ''
      });
    }
  }

  return [...sourcesByPhone.values()];
}

function objectIdFromDate(date) {
  const seconds = Math.max(0, Math.floor(new Date(date).getTime() / 1000));
  if (typeof ObjectID.createFromTime === 'function') {
    return ObjectID.createFromTime(seconds);
  }
  const buf = Buffer.alloc(12);
  buf.writeUInt32BE(seconds, 0);
  return new ObjectID(buf);
}

function docTimestamp(doc) {
  const candidates = [doc.timestamp, doc.time, doc.created, doc.date, doc.t];
  for (const value of candidates) {
    if (value == null || value === '') continue;
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) {
      const ms = num < 1e12 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  if (doc._id && typeof doc._id.getTimestamp === 'function') {
    try {
      const d = doc._id.getTimestamp();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch {
      // ignore
    }
  }
  return new Date();
}

function stripJid(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.split('@')[0].split(':')[0];
}

function extractContactPhone(doc, bizDigits) {
  const fromMe = isFromMe(doc);
  const ordered = fromMe
    ? [doc.phone, doc.to, doc.chatId, doc.remoteJid, doc.wa_id, doc.sender, doc.user, doc.from]
    : [doc.phone, doc.from, doc.chatId, doc.remoteJid, doc.wa_id, doc.sender, doc.user, doc.to];

  for (const candidate of ordered) {
    const digits = digitsOnly(normalizePhone(stripJid(candidate)) || stripJid(candidate));
    if (digits && digits !== bizDigits && digits.length >= 8) return digits;
  }
  return '';
}

function isFromMe(doc) {
  const v = doc.fromMe;
  return v === 1 || v === '1' || v === true;
}

function uniqueOptions(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const text = String(item || '').trim();
    if (!text || text === 'default' || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }
  return out;
}

function extractFromInteractive(obj) {
  if (!obj || typeof obj !== 'object') return { type: 'Text', text: '' };

  const text = String(
    obj?.body?.text ??
    obj?.text ??
    obj?.caption ??
    obj?.title ??
    ''
  ).trim();

  const buttons = Array.isArray(obj?.action?.buttons)
    ? obj.action.buttons.map((b) => b?.reply?.title || b?.title || b?.text || '')
    : [];
  const listRows = [];
  const sections = obj?.action?.sections;
  if (Array.isArray(sections)) {
    for (const section of sections) {
      for (const row of section?.rows || []) {
        listRows.push(row?.title || row?.id || '');
      }
    }
  }
  const options = uniqueOptions([...buttons, ...listRows]);
  if (options.length > 0) {
    return { type: 'Options', text, options };
  }

  const url = obj.url || obj.link || obj.image || obj.video || obj.audio || obj.document || '';
  if (url && typeof url === 'string' && /^https?:\/\//i.test(url)) {
    if (/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)) return { type: 'Image', text, url };
    if (/\.(mp4|mov|webm)(\?|$)/i.test(url)) return { type: 'Video', text, url };
    if (/\.(oga|ogg|mp3|wav|m4a|aac|opus)(\?|$)/i.test(url)) return { type: 'Audio', text, url };
    return { type: 'Document', text, url };
  }

  return { type: 'Text', text };
}

function parseBody(body) {
  if (body == null) return { type: 'Text', text: '' };
  if (typeof body === 'object') return extractFromInteractive(body);
  const str = String(body);
  const trimmed = str.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return extractFromInteractive(JSON.parse(trimmed));
    } catch {
      // keep raw text
    }
  }
  if (/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(trimmed)) {
    return { type: 'Image', text: '', url: trimmed };
  }
  if (/^https?:\/\/.+\.(mp4|mov|webm)(\?.*)?$/i.test(trimmed)) {
    return { type: 'Video', text: '', url: trimmed };
  }
  if (/^https?:\/\/.+\.(oga|ogg|mp3|wav|m4a|aac|opus)(\?.*)?$/i.test(trimmed)) {
    return { type: 'Audio', text: '', url: trimmed };
  }
  return { type: 'Text', text: str };
}

function toHistoryEntry(doc, bizDigits) {
  const parsed = parseBody(doc.body ?? doc.text ?? doc.caption ?? '');
  const fromMe = isFromMe(doc);
  const created = docTimestamp(doc).toISOString();
  const type = fromMe ? (parsed.type || 'Text') : (parsed.type === 'Text' ? 'UserInput' : parsed.type);
  return {
    sender: fromMe ? 'bot' : 'user',
    type,
    text: parsed.text || '',
    content: parsed.text || '',
    ...(parsed.url ? { url: parsed.url } : {}),
    ...(parsed.options ? { options: parsed.options } : {}),
    created,
    legacy_id: doc._id ? String(doc._id) : undefined,
    restored: true
  };
}

function dateRangeQuery(fromDate, untilDate) {
  const fromId = objectIdFromDate(fromDate);
  const untilId = objectIdFromDate(new Date(untilDate.getTime() + 1000));
  return {
    $or: [
      { _id: { $gte: fromId, $lt: untilId } },
      { timestamp: { $gte: fromDate, $lte: untilDate } },
      { time: { $gte: fromDate, $lte: untilDate } }
    ]
  };
}

async function ensureLegacyDb() {
  if (!isSmsConfigured()) return null;
  if (!isSmsConnected()) await connectSmsDb();
  return getSmsDb();
}

export async function previewLegacyCollections(user) {
  const db = await ensureLegacyDb();
  const sources = listUserFbizSources(user).map((source) => ({
    ...source,
    name: fbizCollectionName(source.phone)
  }));
  if (!db) {
    return {
      connected: false,
      collections: sources.map((source) => ({ ...source, exists: false }))
    };
  }
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));
  return {
    connected: true,
    collections: sources.map((source) => ({
      ...source,
      exists: existing.has(source.name)
    }))
  };
}

async function loadExistingLegacyIds(userId, phones) {
  const collection = mongoose.connection.collection('BotSession');
  const sessions = await collection.find(
    {
      user_id: { $in: [userId, String(userId)] },
      $or: [
        { sender: { $in: phones } },
        { customer_phone: { $in: phones } }
      ]
    },
    { projection: { process_history: 1 } }
  ).toArray();

  const ids = new Set();
  for (const session of sessions) {
    for (const item of session.process_history || []) {
      if (item?.legacy_id) ids.add(String(item.legacy_id));
    }
  }
  return ids;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function restoreLegacyConversations({ user, untilDate, months, collectionName }) {
  const monthsNum = Math.min(MAX_MONTHS, Math.max(1, parseInt(months, 10) || 1));
  const until = untilDate ? new Date(untilDate) : new Date();
  until.setHours(23, 59, 59, 999);
  if (isNaN(until.getTime())) {
    throw new Error('invalid_until_date');
  }
  const from = new Date(until);
  from.setMonth(from.getMonth() - monthsNum);
  from.setHours(0, 0, 0, 0);

  const db = await ensureLegacyDb();
  if (!db) {
    const err = new Error('legacy_db_unavailable');
    err.status = 503;
    throw err;
  }

  const userId = user._id.toString();
  const preview = await previewLegacyCollections(user);
  let targets = preview.collections.filter((c) => c.exists);
  if (collectionName) {
    const requested = String(collectionName).trim();
    const name = requested.startsWith(FBIZ_PREFIX) ? requested : fbizCollectionName(requested);
    const selectedSource = preview.collections.find((source) => source.name === name && source.exists);
    if (!selectedSource) {
      const err = new Error('legacy_collection_not_found');
      err.status = 404;
      throw err;
    }
    targets = [selectedSource];
  }
  if (targets.length === 0) {
    const err = new Error('legacy_collection_not_found');
    err.status = 404;
    throw err;
  }

  const firstBot = await BotFlow.findOne({ user_id: userId }).sort({ created_at: 1 }).select('_id name').lean();
  const flowId = firstBot?._id?.toString() || null;
  const query = dateRangeQuery(from, until);

  const byPhone = new Map();
  let scanned = 0;
  let skippedNoPhone = 0;

  for (const target of targets) {
    const col = db.collection(target.name);
    const cursor = col.find(query).sort({ _id: 1 });
    if (typeof cursor.batchSize === 'function') cursor.batchSize(500);

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      scanned += 1;
      const phone = extractContactPhone(doc, target.phone);
      if (!phone) {
        skippedNoPhone += 1;
        continue;
      }
      const entry = toHistoryEntry(doc, target.phone);
      if (!entry.legacy_id && !entry.text && !entry.url) continue;
      if (!byPhone.has(phone)) byPhone.set(phone, []);
      byPhone.get(phone).push(entry);
    }
  }

  const phones = [...byPhone.keys()];
  const existingIds = await loadExistingLegacyIds(userId, phones);

  let importedMessages = 0;
  let skippedDuplicates = 0;
  let createdSessions = 0;
  const botSession = mongoose.connection.collection('BotSession');
  const now = new Date();

  for (const phone of phones) {
    const entries = (byPhone.get(phone) || [])
      .filter((e) => {
        if (e.legacy_id && existingIds.has(e.legacy_id)) {
          skippedDuplicates += 1;
          return false;
        }
        return true;
      })
      .sort((a, b) => String(a.created).localeCompare(String(b.created)));

    if (entries.length === 0) continue;

    for (const part of chunk(entries, CHUNK_SIZE)) {
      const firstCreated = new Date(part[0].created);
      const lastCreated = new Date(part[part.length - 1].created);
      await botSession.insertOne({
        user_id: userId,
        flow_id: flowId,
        customer_phone: phone,
        sender: phone,
        current_node_id: null,
        is_active: false,
        waiting_text_input: false,
        waiting_webservice: false,
        parameters: {
          _restored_from_legacy: true,
          _legacy_until: until.toISOString(),
          _legacy_months: monthsNum
        },
        process_history: part,
        is_agent: false,
        status: 'closed',
        created_at: isNaN(firstCreated.getTime()) ? now : firstCreated,
        createdAt: isNaN(firstCreated.getTime()) ? now : firstCreated,
        updatedAt: isNaN(lastCreated.getTime()) ? now : lastCreated
      });
      createdSessions += 1;
      importedMessages += part.length;
      for (const e of part) {
        if (e.legacy_id) existingIds.add(e.legacy_id);
      }
    }

    await Contact.updateOne(
      { user_id: userId, phone },
      { $setOnInsert: { user_id: userId, phone, full_name: '', whatsapp_name: '', assigned_to: [] } },
      { upsert: true }
    );
  }

  return {
    from: from.toISOString(),
    until: until.toISOString(),
    months: monthsNum,
    collections: targets.map((t) => t.name),
    scanned,
    skippedNoPhone,
    skippedDuplicates,
    importedMessages,
    createdSessions,
    contacts: phones.length
  };
}
