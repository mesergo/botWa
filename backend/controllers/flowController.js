
import Version from '../models/Version.js';
import Widget from '../models/Widget.js';
import Option from '../models/Option.js';
import AuditLog from '../models/AuditLog.js';
import { mongoose } from '../config/db.js';
import { getEffectiveUserId } from '../middleware/auth.js';

// Records a rejected/forced sync attempt so we always have a paper trail when
// a bot was almost wiped (or was wiped via an explicit override).
const logSyncEvent = async (action, req, userId, flow_id, standard_process_id, details) => {
  try {
    await AuditLog.create({
      action,
      actor_id: req.user?.id || userId,
      actor_email: req.user?.email,
      target_id: flow_id || standard_process_id || null,
      target_type: standard_process_id ? 'StandardProcess' : 'BotFlow',
      details: {
        flow_id: flow_id || null,
        standard_process_id: standard_process_id || null,
        ip: req.ip,
        ua: req.headers['user-agent']?.substring(0, 200),
        ...details
      },
      ip_address: req.ip
    });
  } catch (e) {
    console.error('Failed to write AuditLog for sync event', e);
  }
};

// Build the same query syncFlow uses for cleanup, so the snapshot/count match the
// scope of widgets that would be deleted.
const buildScopeQuery = (userId, flow_id, standard_process_id) => {
  if (standard_process_id) {
    return {
      user_id: userId,
      $or: [
        { standard_process_id: standard_process_id, isStandardProcess: 0 },
        { parent_process_id: standard_process_id },
        { standard_process_id: standard_process_id, isStandardProcess: 1, flow_id: null, parent_process_id: null }
      ]
    };
  }
  return {
    user_id: userId,
    flow_id: flow_id,
    $or: [{ standard_process_id: null }, { isStandardProcess: 1 }]
  };
};

// Snapshot the existing widgets+options into a Version document tagged
// __autobackup__ BEFORE we run deleteMany. If anything goes wrong (bad client
// payload, server crash mid-write, etc.) we can always restore from this row.
// Keeps the most recent N backups per (user, flow, process) and prunes the rest.
const AUTOBACKUP_RETAIN = 5;
const snapshotBeforeWrite = async (userId, flow_id, standard_process_id) => {
  try {
    const scopeQuery = buildScopeQuery(userId, flow_id, standard_process_id);
    const widgets = await Widget.find(scopeQuery).lean();
    if (!widgets.length) return null; // nothing to back up

    const options = await Option.find({ widget_id: { $in: widgets.map(w => w.id) } }).lean();

    const backup = await Version.create({
      name: `__autobackup__ ${new Date().toISOString()}`,
      user_id: userId,
      flow_id: flow_id || null,
      standard_process_id: standard_process_id || null,
      isLocked: false,
      data: { widgets, options },
      created_at: new Date()
    });

    // Prune older autobackups so the collection doesn't grow forever
    const oldBackups = await Version.find({
      user_id: userId,
      flow_id: flow_id || null,
      standard_process_id: standard_process_id || null,
      name: { $regex: '^__autobackup__ ' }
    }).sort({ created_at: -1 }).skip(AUTOBACKUP_RETAIN);
    if (oldBackups.length) {
      await Version.deleteMany({ _id: { $in: oldBackups.map(b => b._id) } });
    }

    return backup._id;
  } catch (e) {
    console.error('snapshotBeforeWrite failed (continuing without backup)', e);
    return null;
  }
};

const fetchFlowData = async (userId, flow_id, standard_process_id = null, versionId = null) => {
  if (versionId) {
    try {
      const version = await Version.findById(versionId);
      if (version) {
        return { 
          nodes: version.data.nodes || [], 
          edges: version.data.edges || [] 
        };
      }
    } catch (e) {
      console.error("Error fetching version snapshot", e);
    }
  }

  // Define query based on whether we are loading a global process or a specific bot flow
  let query = { user_id: userId };
  
  if (standard_process_id) {
    // When loading a standard process: get content widgets (isStandardProcess:0) AND
    // nested fixed_process reference nodes that live inside this process.
    // Supports two storage formats:
    //   NEW: parent_process_id = this process, standard_process_id = child
    //   OLD (legacy): standard_process_id = this process, isStandardProcess=1, flow_id=null
    query.$or = [
      { standard_process_id: standard_process_id, isStandardProcess: 0 },
      { parent_process_id: standard_process_id },
      { standard_process_id: standard_process_id, isStandardProcess: 1, flow_id: null, parent_process_id: null }
    ];
  } else {
    // When loading a bot flow, we filter by its flow_id
    query.flow_id = flow_id;
    query.$or = [{ standard_process_id: null }, { isStandardProcess: 1 }];
  }

  console.log('📖 טוען widgets עם query:', JSON.stringify(query));
  const rawWidgets = await Widget.find(query);
  console.log(`📊 נמצאו ${rawWidgets.length} widgets`);

  // Deduplicate: keep only 1 automatic_responses per flow (prefer is_first=1)
  const autoResponseWidgets = rawWidgets.filter(w => w.type === 'automatic_responses');
  const otherWidgets = rawWidgets.filter(w => w.type !== 'automatic_responses');
  const bestAutoResponse = autoResponseWidgets.length > 0
    ? (autoResponseWidgets.find(w => w.is_first === 1) || autoResponseWidgets[0])
    : null;
  const widgets = bestAutoResponse ? [bestAutoResponse, ...otherWidgets] : otherWidgets;
  if (autoResponseWidgets.length > 1) {
    console.warn(`⚠️ נמצאו ${autoResponseWidgets.length} רכיבי automatic_responses - נשמר רק 1`);
  }

  const options = await Option.find({ 
    widget_id: { $in: widgets.map(w => w.id) } 
  });
  
  const nodes = widgets.map(w => {
    let metadata = w.image_file || {};
    const nodeOptions = options.filter(o => o.widget_id === w.id);
    
    // Special handling for TIME_ROUTING
    if (w.type === 'action_time_routing') {
      const timeRanges = nodeOptions
        .filter(o => o.operator === 'time_range')
        .map(o => {
          const [fromHour, toHour] = o.value.split('-').map(Number);
          return { fromHour, toHour };
        });
      
      return { 
        id: w.id, 
        type: w.type, 
        position: { x: w.pos_x, y: w.pos_y }, 
        data: { 
          ...metadata,
          timeRanges: timeRanges
        } 
      };
    }
    
    // For action_web_service and output_menu: exclude the 'default' option from the conditional branches data
    const conditionalOptions = (w.type === 'action_web_service' || w.type === 'output_menu')
      ? nodeOptions.filter(o => o.operator !== 'default')
      : nodeOptions;

    return { 
      id: w.id, 
      type: w.type, 
      position: { x: w.pos_x, y: w.pos_y }, 
      data: { 
        ...metadata,
        label: metadata.label !== undefined ? metadata.label : (w.value || (w.type === 'start' ? 'תחילת תזרים' : '')), 
        content: metadata.content !== undefined ? metadata.content : (w.value || ''), 
        options: conditionalOptions.length > 0 ? conditionalOptions.map(o => o.value) : undefined, 
        optionOperators: conditionalOptions.length > 0 ? conditionalOptions.map(o => o.operator || 'eq') : undefined,
        optionImages: conditionalOptions.length > 0 ? conditionalOptions.map(o => o.image_url) : undefined 
      } 
    };
  });

  const edges = [];
  widgets.forEach(w => {
    if (w.next) {
      edges.push({ id: `e-${w.id}-${w.next}`, source: w.id, target: w.next, type: 'button', style: { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '6,4' } });
    }
    const wOptions = options.filter(o => o.widget_id === w.id);
    
    // Special handling for TIME_ROUTING
    if (w.type === 'action_time_routing') {
      let timeRangeIndex = 0;
      wOptions.forEach((o) => { 
        if (o.next) {
          const sourceHandle = o.operator === 'default' ? 'option-default' : `option-${timeRangeIndex}`;
          edges.push({ 
            id: `e-${w.id}-${sourceHandle}-${o.next}`, 
            source: w.id, 
            sourceHandle: sourceHandle, 
            target: o.next, 
            type: 'button', 
            style: { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '6,4' } 
          });
          if (o.operator === 'time_range') timeRangeIndex++;
        } else if (o.operator === 'time_range') {
          timeRangeIndex++;
        }
      });
    } else {
      // For action_web_service and output_menu: separate 'default' options from conditional ones
      const isDefaultSeparated = w.type === 'action_web_service' || w.type === 'output_menu';
      const defaultOpts = isDefaultSeparated ? wOptions.filter(o => o.operator === 'default') : [];
      const conditionalOpts = isDefaultSeparated ? wOptions.filter(o => o.operator !== 'default') : wOptions;

      conditionalOpts.forEach((o, i) => { 
        if (o.next) { 
          edges.push({ id: `e-${w.id}-opt-${i}`, source: w.id, sourceHandle: `option-${i}`, target: o.next, type: 'button', style: { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '6,4' } }); 
        } 
      });

      // Reconstruct the 'default' exit edge for action_web_service
      if (w.type === 'action_web_service') {
        defaultOpts.forEach(o => {
          if (o.next) {
            edges.push({ id: `e-${w.id}-default-${o.next}`, source: w.id, sourceHandle: 'default', target: o.next, type: 'button', style: { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '6,4' } });
          }
        });
      }

      // Reconstruct the 'option-default' exit edge for output_menu
      if (w.type === 'output_menu') {
        defaultOpts.forEach(o => {
          if (o.next) {
            edges.push({ id: `e-${w.id}-option-default-${o.next}`, source: w.id, sourceHandle: 'option-default', target: o.next, type: 'button', style: { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '6,4' } });
          }
        });
      }
    }
  });

  return { nodes, edges };
};

// Per-flow serialization lock: prevents concurrent syncFlow calls for the same flow
// from interleaving their deleteMany + create sequences, which would cause duplicates.
const flowSyncQueue = new Map(); // lockKey -> Promise

const withFlowLock = (lockKey, fn) => {
  const prev = flowSyncQueue.get(lockKey) || Promise.resolve();
  let releaseLock;
  const next = new Promise(resolve => { releaseLock = resolve; });
  flowSyncQueue.set(lockKey, next);
  return prev.then(() => fn()).finally(() => {
    releaseLock();
    if (flowSyncQueue.get(lockKey) === next) flowSyncQueue.delete(lockKey);
  });
};

export const syncFlow = async (req, res) => {
  // rep (sessions-only) cannot edit flows
  if (req.user?.role === 'rep') {
    return res.status(403).json({ error: 'Access denied. Representatives without bot access cannot edit flows.' });
  }
  const userId = getEffectiveUserId(req);
  const {
    nodes,
    edges,
    flow_id,
    standard_process_id = null,
    // Optional safety controls from the client:
    // - force: explicit override to bypass shrink/empty guards (used by intentional
    //   "change template" / "clear flow" actions). Never set by the auto-save loop.
    // - expected_widget_count: how many widgets the client believes exist on the
    //   server (snapshot taken at load). If it doesn't match, we're racing another
    //   tab and we refuse to overwrite (optimistic concurrency).
    force = false,
    expected_widget_count
  } = req.body;

  console.log('🔵 syncFlow - התחלה:', {
    userId,
    flow_id,
    standard_process_id,
    nodesCount: nodes?.length,
    edgesCount: edges?.length,
    force: !!force,
    expected_widget_count
  });

  if (!flow_id && !standard_process_id) {
      return res.status(400).json({ error: 'Missing flow_id' });
  }

  if (!Array.isArray(nodes)) {
    return res.status(400).json({ error: 'nodes must be an array' });
  }

  // Pull the current widget count up-front; we use it for every guard below.
  const scopeQuery = buildScopeQuery(userId, flow_id, standard_process_id);
  const existingCount = await Widget.countDocuments(scopeQuery);

  // ── Guard 1: empty payload ────────────────────────────────────────────────
  // Refuse to wipe a flow when the client sent an empty nodes array — root cause
  // of the 15/06/2026 incident where bots were silently emptied.
  if (nodes.length === 0 && !force) {
    console.warn('🛑 syncFlow rejected — empty nodes', { userId, flow_id, standard_process_id, existingCount });
    await logSyncEvent('SYNC_REJECTED_EMPTY', req, userId, flow_id, standard_process_id, { existingCount });
    return res.status(409).json({
      error: 'EMPTY_PAYLOAD',
      message: 'בקשה ריקה — לא ניתן לשמור תרשים ללא רכיבים. רענני את הדף ונסי שוב.',
      existingCount
    });
  }

  // ── Guard 2: optimistic concurrency (two tabs) ────────────────────────────
  // If the client told us how many widgets it thought existed when it loaded,
  // and that no longer matches reality, another save happened in between —
  // refuse and tell the client to reload.
  if (
    !force &&
    typeof expected_widget_count === 'number' &&
    existingCount > 0 &&
    existingCount !== expected_widget_count
  ) {
    console.warn('🛑 syncFlow rejected — stale state', {
      userId, flow_id, standard_process_id, existingCount, expected_widget_count
    });
    await logSyncEvent('SYNC_REJECTED_STALE', req, userId, flow_id, standard_process_id, {
      existingCount, expected_widget_count
    });
    return res.status(409).json({
      error: 'STALE_STATE',
      message: 'הבוט עודכן ע"י לשונית/משתמש אחר. רענני את הדף כדי לראות את הגרסה המעודכנת.',
      existingCount,
      expected_widget_count
    });
  }

  // ── Guard 3: massive shrink ───────────────────────────────────────────────
  // If the existing flow is non-trivial and the incoming payload is dramatically
  // smaller, refuse. Catches "loaded empty due to UI bug, then saved" cases that
  // slip past Guard 1 because the UI auto-injected a single bootstrap node.
  const SHRINK_FLOOR = 5;        // only protect once a flow has at least this many nodes
  const SHRINK_RATIO = 0.5;      // incoming must be < 50% of existing to trip
  if (
    !force &&
    existingCount >= SHRINK_FLOOR &&
    nodes.length < Math.ceil(existingCount * SHRINK_RATIO)
  ) {
    // Special-case: client sent only a single auto-bootstrap node (start /
    // automatic_responses with no real children). This is the signature of the
    // "loaded blank, then saved" bug — always reject.
    const onlyBootstrap = nodes.length <= 1 &&
      nodes.every(n => n.type === 'start' || n.type === 'automatic_responses');

    console.warn('🛑 syncFlow rejected — suspicious shrink', {
      userId, flow_id, standard_process_id, existingCount, incoming: nodes.length, onlyBootstrap
    });
    await logSyncEvent('SYNC_REJECTED_SHRINK', req, userId, flow_id, standard_process_id, {
      existingCount, incoming: nodes.length, onlyBootstrap
    });
    return res.status(409).json({
      error: 'SUSPICIOUS_SHRINK',
      message: `שמירה נחסמה: הקנבס מכיל ${nodes.length} רכיבים אך בשרת קיימים ${existingCount}. רענני את הדף לפני שמירה. אם זו פעולה מכוונת, אשרי מחדש.`,
      existingCount,
      incoming: nodes.length
    });
  }

  // If we got here with force=true and the action is destructive, log it loudly.
  if (force && (nodes.length === 0 || nodes.length < existingCount)) {
    await logSyncEvent('SYNC_FORCED_DESTRUCTIVE', req, userId, flow_id, standard_process_id, {
      existingCount, incoming: nodes.length
    });
  }

  const lockKey = `${userId}:${flow_id || standard_process_id}`;

  withFlowLock(lockKey, async () => {
    // Take a snapshot of what's about to be deleted. If anything goes wrong
    // we can recover from the __autobackup__ Version row.
    const backupId = await snapshotBeforeWrite(userId, flow_id, standard_process_id);
    if (backupId) console.log(`🛟 autobackup created: ${backupId}`);

    const cleanupQuery = scopeQuery;

    console.log('🗑️ מוחק widgets קיימים:', cleanupQuery);
    const deleteResult = await Widget.deleteMany(cleanupQuery);
    console.log(`✅ נמחקו ${deleteResult.deletedCount} widgets`);

    // Deduplicate: keep only 1 automatic_responses in incoming nodes
    let autoResponseSeen = false;
    const deduplicatedNodes = nodes.filter(n => {
      if (n.type === 'automatic_responses') {
        if (autoResponseSeen) {
          console.warn(`⚠️ רכיב automatic_responses כפול הוסר מה-sync`);
          return false;
        }
        autoResponseSeen = true;
      }
      return true;
    });

    const widgetIds = deduplicatedNodes.map(n => n.id);
    const optionsDeleteResult = await Option.deleteMany({ widget_id: { $in: widgetIds } });
    console.log(`✅ נמחקו ${optionsDeleteResult.deletedCount} options`);

    for (const node of deduplicatedNodes) {
      const isFirst = (node.type === 'start' || node.type === 'automatic_responses') ? 1 : 0;
      const isBranching = node.type === 'output_menu' || node.type === 'action_web_service' || node.type === 'automatic_responses' || node.type === 'action_time_routing';
      // Use findLast so that if there are duplicate edges for the same source+handle
      // (e.g. old DB edges coexisting with a new connection), the most-recently-added
      // edge wins. This is a safety-net; the frontend already de-duplicates on connect.
      const findLastEdge = (predicate) => {
        for (let i = edges.length - 1; i >= 0; i--) {
          if (predicate(edges[i])) return edges[i];
        }
        return undefined;
      };
      const nextEdge = !isBranching ? findLastEdge(e => e.source === node.id && !e.sourceHandle) : null;
      const nextId = nextEdge ? nextEdge.target : null;
      const isProxy = (node.type === 'fixed_process' || node.data.isStandardProcess) ? 1 : 0;

      // A fixed_process reference node inside a standard process:
      //   standard_process_id = child process being called (preserved for execution)
      //   parent_process_id   = the standard process this node lives in (for ownership)
      // A regular content node inside a standard process:
      //   standard_process_id = the process it belongs to, parent_process_id = null
      // A fixed_process reference in a main flow:
      //   standard_process_id = child process, flow_id = main flow, parent_process_id = null
      const isNestedProcessRef = !!standard_process_id && node.type === 'fixed_process';
      const nodeProcessId = isNestedProcessRef
        ? (node.data.processId || null)
        : (standard_process_id || node.data.processId || null);
      const nodeParentProcessId = isNestedProcessRef ? standard_process_id : null;

      // IMPORTANT: If editing a standard process, we save flow_id as null to make it global
      const finalFlowId = standard_process_id ? null : flow_id;

      const metadataObj = { ...node.data };
      delete metadataObj.onChange;
      delete metadataObj.onDelete;
      delete metadataObj.options;
      delete metadataObj.optionOperators;
      delete metadataObj.optionImages;

      const widgetData = {
        id: node.id,
        user_id: userId,
        flow_id: finalFlowId,
        is_first: isFirst,
        type: node.type,
        value: node.data.label || node.data.content || '',
        pos_x: node.position.x,
        pos_y: node.position.y,
        next: nextId,
        image_file: metadataObj,
        standard_process_id: nodeProcessId,
        parent_process_id: nodeParentProcessId || null,
        isStandardProcess: isProxy
      };
      
      console.log(`💾 שומר widget: ${node.type} (${node.id})`, {
        flow_id: widgetData.flow_id,
        standard_process_id: widgetData.standard_process_id,
        isStandardProcess: widgetData.isStandardProcess,
        value: widgetData.value
      });
      const savedWidget = await Widget.create(widgetData);
      const localTime = new Date(savedWidget.createdAt).toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
      console.log(`⏰ Widget נשמר - UTC: ${savedWidget.createdAt.toISOString()}, מקומי: ${localTime}, value: "${savedWidget.value}"`);
      
      // Handle TIME_ROUTING differently - it has timeRanges + default option
      if (node.type === 'action_time_routing') {
        const timeRanges = node.data.timeRanges || [];
        
        // Save each time range as an option
        for (let i = 0; i < timeRanges.length; i++) {
          const range = timeRanges[i];
          const optionEdge = findLastEdge(e => e.source === node.id && e.sourceHandle === `option-${i}`);
          await Option.create({
            widget_id: node.id,
            value: `${range.fromHour}-${range.toHour}`, // Store as "8-16"
            next: optionEdge ? optionEdge.target : null,
            image_url: null,
            operator: 'time_range' // Special operator for time ranges
          });
        }
        
        // Save the default option
        const defaultEdge = findLastEdge(e => e.source === node.id && e.sourceHandle === 'option-default');
        if (defaultEdge) {
          await Option.create({
            widget_id: node.id,
            value: 'default',
            next: defaultEdge.target,
            image_url: null,
            operator: 'default'
          });
        }
      } else if (node.type === 'output_menu') {
        // output_menu gets its own block so edges are always saved even when
        // node.data.options is undefined (user connected handles without typing)
        const menuOptions = node.data.options || [];
        for (let i = 0; i < menuOptions.length; i++) {
          const optionEdge = findLastEdge(e => e.source === node.id && e.sourceHandle === `option-${i}`);
          await Option.create({
            widget_id: node.id,
            value: menuOptions[i],
            next: optionEdge ? optionEdge.target : null,
            image_url: node.data.optionImages?.[i] || null,
            operator: node.data.optionOperators?.[i] || 'eq'
          });
        }
        // Always save the option-default edge regardless of whether there are options
        const menuDefaultEdge = findLastEdge(e => e.source === node.id && e.sourceHandle === 'option-default');
        if (menuDefaultEdge) {
          await Option.create({
            widget_id: node.id,
            value: 'default',
            next: menuDefaultEdge.target,
            image_url: null,
            operator: 'default'
          });
        }
      } else if (isBranching && node.data.options) {
        for (let i = 0; i < node.data.options.length; i++) {
          const branchValue = node.data.options[i];
          const branchOperator = node.data.optionOperators?.[i] || 'eq';
          const optionEdge = findLastEdge(e => e.source === node.id && e.sourceHandle === `option-${i}`);
          await Option.create({
            widget_id: node.id,
            value: branchValue,
            next: optionEdge ? optionEdge.target : null,
            image_url: node.data.optionImages?.[i] || null,
            operator: branchOperator
          });
        }
        // For action_web_service: also save the 'default' exit edge
        if (node.type === 'action_web_service') {
          const defaultEdge = findLastEdge(e => e.source === node.id && e.sourceHandle === 'default');
          if (defaultEdge) {
            await Option.create({
              widget_id: node.id,
              value: 'default',
              next: defaultEdge.target,
              image_url: null,
              operator: 'default'
            });
          }
        }
      } else if (isBranching && node.type === 'action_web_service') {
        // No conditional options, but still save the default exit edge
        const defaultEdge = findLastEdge(e => e.source === node.id && e.sourceHandle === 'default');
        if (defaultEdge) {
          await Option.create({
            widget_id: node.id,
            value: 'default',
            next: defaultEdge.target,
            image_url: null,
            operator: 'default'
          });
        }
      }
    }
    
    console.log(`✅ syncFlow הושלם בהצלחה - נשמרו ${deduplicatedNodes.length} widgets`);
    res.json({ success: true, widget_count: deduplicatedNodes.length });
  }).catch(err => {
    console.error('❌ שגיאה ב-syncFlow:', err);
    res.status(500).json({ error: err.message });
  });
};

export const getFlow = async (req, res) => {
  const userId = getEffectiveUserId(req);
  const { flow_id, standard_process_id = null, version_id = null } = req.query;
  try {
    const data = await fetchFlowData(userId, flow_id, standard_process_id, version_id);
    // Return the authoritative widget count for optimistic-concurrency / shrink
    // protection on the client. When loading a version snapshot, the count is
    // simply the number of nodes in that snapshot.
    let widgetCount = data.nodes.length;
    if (!version_id) {
      const scopeQuery = buildScopeQuery(userId, flow_id, standard_process_id);
      widgetCount = await Widget.countDocuments(scopeQuery);
    }
    res.json({ ...data, widget_count: widgetCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getPublicFlow = async (req, res) => {
  const { userId } = req.params; // This userId is the public_id from URL
  const { flow_id, standard_process_id = null, version_id = null } = req.query;
  try {
    // Access the collection via mongoose connection
    const userCollection = mongoose.connection.collection('User');
    
    // We need to find the real owner database ID using the public_id provided in the URL
    const owner = await userCollection.findOne({ public_id: userId });
    if (!owner) {
      return res.status(404).json({ error: 'Flow owner not found' });
    }
    const internalUserId = owner._id.toString();

    // Fix: If flow_id is missing or 'null', try to find the most recent bot of this user
    let targetFlowId = flow_id;
    if (!targetFlowId || targetFlowId === 'null') {
      const botCollection = mongoose.connection.collection('bot_flows');
      const latestBot = await botCollection.findOne({ user_id: internalUserId }, { sort: { created_at: -1 } });
      if (latestBot) targetFlowId = latestBot._id.toString();
    }

    const data = await fetchFlowData(internalUserId, targetFlowId, standard_process_id, version_id);
    res.json(data);
  } catch (err) { 
    console.error("Public Flow Error:", err);
    res.status(500).json({ error: err.message }); 
  }
};
