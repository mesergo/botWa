
import Version from '../models/Version.js';
import Widget from '../models/Widget.js';
import Option from '../models/Option.js';
import { mongoose } from '../config/db.js';

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
      { standard_process_id: standard_process_id, isStandardProcess: 1, flow_id: null }
    ];
  } else {
    // When loading a bot flow, we filter by its flow_id
    query.flow_id = flow_id;
    query.$or = [{ standard_process_id: null }, { isStandardProcess: 1 }];
  }

  console.log('📖 טוען widgets עם query:', JSON.stringify(query));
  const widgets = await Widget.find(query);
  console.log(`📊 נמצאו ${widgets.length} widgets`);
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
    
    // For action_web_service: exclude the 'default' option from the conditional branches data
    const conditionalOptions = w.type === 'action_web_service'
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
      // For action_web_service: separate 'default' options from conditional ones
      const defaultOpts = w.type === 'action_web_service' ? wOptions.filter(o => o.operator === 'default') : [];
      const conditionalOpts = w.type === 'action_web_service' ? wOptions.filter(o => o.operator !== 'default') : wOptions;

      conditionalOpts.forEach((o, i) => { 
        if (o.next) { 
          edges.push({ id: `e-${w.id}-opt-${i}`, source: w.id, sourceHandle: `option-${i}`, target: o.next, type: 'button', style: { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '6,4' } }); 
        } 
      });

      // Reconstruct the 'default' exit edge for action_web_service
      defaultOpts.forEach(o => {
        if (o.next) {
          edges.push({ id: `e-${w.id}-default-${o.next}`, source: w.id, sourceHandle: 'default', target: o.next, type: 'button', style: { stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '6,4' } });
        }
      });
    }
  });

  return { nodes, edges };
};

export const syncFlow = async (req, res) => {
  const userId = req.user.id;
  const { nodes, edges, flow_id, standard_process_id = null } = req.body;

  console.log('🔵 syncFlow - התחלה:', {
    userId,
    flow_id,
    standard_process_id,
    nodesCount: nodes?.length,
    edgesCount: edges?.length
  });

  if (!flow_id && !standard_process_id) {
      return res.status(400).json({ error: 'Missing flow_id' });
  }
  
  try {
    const cleanupQuery = standard_process_id 
        ? { user_id: userId, $or: [
            { standard_process_id: standard_process_id, isStandardProcess: 0 },
            { parent_process_id: standard_process_id },
            { standard_process_id: standard_process_id, isStandardProcess: 1, flow_id: null }
          ]}
        : { user_id: userId, flow_id: flow_id, $or: [{ standard_process_id: null }, { isStandardProcess: 1 }] };

    console.log('🗑️ מוחק widgets קיימים:', cleanupQuery);
    const deleteResult = await Widget.deleteMany(cleanupQuery);
    console.log(`✅ נמחקו ${deleteResult.deletedCount} widgets`);

    const widgetIds = nodes.map(n => n.id);
    const optionsDeleteResult = await Option.deleteMany({ widget_id: { $in: widgetIds } });
    console.log(`✅ נמחקו ${optionsDeleteResult.deletedCount} options`);

    for (const node of nodes) {
      const isFirst = (node.type === 'start' || node.type === 'automatic_responses') ? 1 : 0;
      const isBranching = node.type === 'output_menu' || node.type === 'action_web_service' || node.type === 'automatic_responses' || node.type === 'action_time_routing';
      const nextEdge = !isBranching ? edges.find(e => e.source === node.id && !e.sourceHandle) : null;
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
          const optionEdge = edges.find(e => e.source === node.id && e.sourceHandle === `option-${i}`);
          await Option.create({
            widget_id: node.id,
            value: `${range.fromHour}-${range.toHour}`, // Store as "8-16"
            next: optionEdge ? optionEdge.target : null,
            image_url: null,
            operator: 'time_range' // Special operator for time ranges
          });
        }
        
        // Save the default option
        const defaultEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'option-default');
        if (defaultEdge) {
          await Option.create({
            widget_id: node.id,
            value: 'default',
            next: defaultEdge.target,
            image_url: null,
            operator: 'default'
          });
        }
      } else if (isBranching && node.data.options) {
        for (let i = 0; i < node.data.options.length; i++) {
          const branchValue = node.data.options[i];
          const branchOperator = node.data.optionOperators?.[i] || 'eq';
          const optionEdge = edges.find(e => e.source === node.id && e.sourceHandle === `option-${i}`);
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
          const defaultEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'default');
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
        const defaultEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'default');
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
    
    console.log(`✅ syncFlow הושלם בהצלחה - נשמרו ${nodes.length} widgets`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ שגיאה ב-syncFlow:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getFlow = async (req, res) => {
  const userId = req.user.id;
  const { flow_id, standard_process_id = null, version_id = null } = req.query;
  try {
    const data = await fetchFlowData(userId, flow_id, standard_process_id, version_id);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
};

export const getPublicFlow = async (req, res) => {
  const { userId } = req.params; // This userId is the public_id from URL
  const { flow_id, version_id = null } = req.query;
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

    const data = await fetchFlowData(internalUserId, targetFlowId, null, version_id);
    res.json(data);
  } catch (err) { 
    console.error("Public Flow Error:", err);
    res.status(500).json({ error: err.message }); 
  }
};
