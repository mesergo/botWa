import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import Option from '../models/Option.js';
import BotSession from '../models/BotSession.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleWebService, findMatchingOption } from '../utils/webserviceHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper: Convert base64 to URL
const convertBase64ToUrl = (base64Data, req) => {
  if (!base64Data || !base64Data.startsWith('data:image')) {
    return base64Data; // Return as-is if not base64
  }

  try {
    const matches = base64Data.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
    if (!matches) return base64Data;

    const ext = matches[1];
    const data = matches[2];
    const buffer = Buffer.from(data, 'base64');

    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `${Date.now()}-${Math.round(Math.random() * 1E9)}.${ext}`;
    const filepath = path.join(uploadDir, filename);

    fs.writeFileSync(filepath, buffer);

    // Return URL
    const protocol = req?.protocol || 'http';
    const host = req?.get('host') || 'localhost:3001';
    return `${protocol}://${host}/uploads/${filename}`;
  } catch (error) {
    console.error('[convertBase64ToUrl] Error:', error);
    return base64Data; // Return original if conversion fails
  }
};

// Helper: Replace parameters in text
const replaceParameters = (text, parameters) => {
  if (!text) return '';
  return text.replace(/--(.+?)--/g, (match, paramName) => {
    const value = parameters[paramName];
    return value !== undefined ? String(value) : 'null';
  });
};

// Helper: Evaluate condition
const evaluateCondition = (operator, value, target) => {
  if (value === null || value === undefined) return false;
  
  const v = isNaN(Number(value)) ? String(value).toLowerCase() : Number(value);
  const t = isNaN(Number(target)) ? String(target).toLowerCase() : Number(target);
  
  switch(operator) {
    case 'gt': return typeof v === 'number' && typeof t === 'number' ? v > t : false;
    case 'gte': return typeof v === 'number' && typeof t === 'number' ? v >= t : false;
    case 'lt': return typeof v === 'number' && typeof t === 'number' ? v < t : false;
    case 'lte': return typeof v === 'number' && typeof t === 'number' ? v <= t : false;
    case 'cont':
    case 'contains': {
      const vStr = String(value).toLowerCase();
      const tStr = String(target).toLowerCase();
      return vStr.includes(tStr) || tStr.includes(vStr);
    }
    case 'contains_any': {
      const words = String(target).toLowerCase().split(/[ ,]+/);
      const valStr = String(value).toLowerCase();
      return words.some(w => w.trim() && (valStr.includes(w.trim()) || w.trim().includes(valStr)));
    }
    case 'contains_all': {
      const words = String(target).toLowerCase().split(/[ ,]+/);
      const valStr = String(value).toLowerCase();
      return words.every(w => !w.trim() || valStr.includes(w.trim()));
    }
    case 'eq':
    default: return String(value).toLowerCase() === String(target).toLowerCase();
  }
};

// Helper: Get flow data (nodes + edges)
const getFlowData = async (flowId, processId = null) => {
  let query = {};
  
  // Ensure flowId is a string
  const flowIdStr = flowId ? String(flowId) : null;
  
  if (processId) {
    // Get content widgets of this process AND nested fixed_process references living inside it.
    // Supports two storage formats:
    //   NEW: parent_process_id = this process, standard_process_id = child
    //   OLD (legacy): standard_process_id = this process, isStandardProcess=1, flow_id=null
    query.$or = [
      { standard_process_id: processId, isStandardProcess: 0 },
      { parent_process_id: processId },
      { standard_process_id: processId, isStandardProcess: 1, flow_id: null }
    ];
  } else if (flowIdStr) {
    // When we have a specific flow_id, only get widgets for that flow
    query.flow_id = flowIdStr;
    // Only include widgets that are NOT references to standard processes
    query.$or = [{ standard_process_id: null }, { isStandardProcess: 1 }];
  } else {
    // No flow_id - this shouldn't happen, but handle it
    console.error('[getFlowData] ❌ No flowId or processId provided!');
    return { nodes: [], edges: [] };
  }

  const widgets = await Widget.find(query);
  const options = await Option.find({ 
    widget_id: { $in: widgets.map(w => w.id) } 
  });
  
  const nodes = widgets.map(w => {
    let metadata = w.image_file || {};
    const nodeOptions = options.filter(o => o.widget_id === w.id);
    
    return { 
      id: w.id, 
      type: w.type, 
      position: { x: w.pos_x, y: w.pos_y }, 
      data: { 
        ...metadata,
        label: metadata.label !== undefined ? metadata.label : (w.value || ''), 
        content: metadata.content !== undefined ? metadata.content : (w.value || ''), 
        options: nodeOptions.length > 0 ? nodeOptions.map(o => o.value) : undefined, 
        optionOperators: nodeOptions.length > 0 ? nodeOptions.map(o => o.operator || 'eq') : undefined,
        optionImages: nodeOptions.length > 0 ? nodeOptions.map(o => o.image_url) : undefined,
        url: metadata.url,
        linkLabel: metadata.linkLabel,
        variableName: metadata.variableName,
        waitTime: metadata.waitTime,
        // For nested fixed_process refs: old format stores child processId in image_file,
        // new format stores it in standard_process_id (parent_process_id holds the parent).
        processId: (w.type === 'fixed_process' ? (metadata.processId || w.standard_process_id) : w.standard_process_id),
        isStandardProcess: w.isStandardProcess ? true : false
      } 
    };
  });

  const edges = [];
  widgets.forEach(w => {
    if (w.next) {
      edges.push({ id: `e-${w.id}-${w.next}`, source: w.id, target: w.next });
    }
    const wOptions = options.filter(o => o.widget_id === w.id);
    wOptions.forEach((o, i) => { 
      if (o.next) { 
        edges.push({ id: `e-${w.id}-opt-${i}`, source: w.id, sourceHandle: `option-${i}`, target: o.next }); 
      } 
    });
  });

  return { nodes, edges };
};

// Helper: Find next node
const findNextNode = (nodeId, edges, handleId = null) => {
  const edge = edges.find(e => 
    e.source === nodeId && (!handleId || e.sourceHandle === handleId)
  );
  return edge ? edge.target : null;
};

// Helper: Add to history
const addToHistory = (session, message, nodeId) => {
  const history = session.process_history || [];
  const isUser = nodeId === 'user';
  history.push({
    ...message,
    node_id: nodeId,
    sender: isUser ? 'user' : 'bot',
    name: isUser ? 'משתמש' : 'בוט',
    created: new Date().toISOString()
  });
  session.process_history = history;
};

// Main: Walk through nodes chain
const walkChain = async (startNodeId, nodes, edges, session, flowId, req = null) => {
  const messages = [];
  let currentNodeId = startNodeId;
  let depth = 0;
  const maxDepth = 250;

  // Helper: end of sub-flow → return to automatic_responses (keep session alive)
  // Mirrors simulator behaviour: flow end does NOT close the session.
  const returnToMenu = () => {
    const autoNode = nodes.find(n => n.type === 'automatic_responses');
    if (autoNode) {
      session.current_node_id   = autoNode.id;
      session.waiting_text_input = false;
      session.waiting_webservice = false;
      session.execution_stack   = [];
    } else {
      session.is_active         = false;
      session.current_node_id   = null;
      session.waiting_text_input = false;
    }
  };

  while (currentNodeId && depth < maxDepth) {
    depth++;
    
    const node = nodes.find(n => n.id === currentNodeId);
    if (!node) break;

    const nodeType = node.type;
    const nodeData = node.data;
    const params = session.parameters || {};

    // Handle different node types
    switch (nodeType) {
      case 'start':
        currentNodeId = findNextNode(currentNodeId, edges);
        break;

      case 'automatic_responses':
        // Stop here - waiting for user input to match
        session.current_node_id = currentNodeId;
        session.waiting_text_input = false;
        return messages;

      case 'output_text': {
        const text = replaceParameters(nodeData.content || '', params);
        const msg = { type: 'Text', text, created: new Date().toISOString() };
        messages.push(msg);
        addToHistory(session, msg, currentNodeId);
        
        // Check if this is the last node (no outgoing edges)
        const nextNode = findNextNode(currentNodeId, edges);
        if (!nextNode) {
          returnToMenu();
          return messages;
        }
        currentNodeId = nextNode;
        break;
      }

      case 'output_image': {
        let url = replaceParameters(nodeData.url || '', params);
        // Convert base64 to URL if needed
        url = convertBase64ToUrl(url, req);
        
        const mediaType = nodeData.mediaType || 'image';
        const caption = replaceParameters(nodeData.caption || '', params);
        
        // Send media message
        const mediaMsg = { 
          type: mediaType === 'video' ? 'Video' : mediaType === 'pdf' ? 'Document' : 'Image', 
          url, 
          created: new Date().toISOString() 
        };
        messages.push(mediaMsg);
        addToHistory(session, mediaMsg, currentNodeId);
        
        // Send caption as separate text message if exists
        if (caption && caption.trim()) {
          const textMsg = { type: 'Text', text: caption, created: new Date().toISOString() };
          messages.push(textMsg);
          addToHistory(session, textMsg, currentNodeId);
        }
        
        // Check if this is the last node (no outgoing edges)
        const nextNode = findNextNode(currentNodeId, edges);
        if (!nextNode) {
          returnToMenu();
          return messages;
        }
        currentNodeId = nextNode;
        break;
      }

      case 'output_link': {
        const text = replaceParameters(nodeData.linkLabel || 'קישור', params);
        // --varName-- placeholders in url are resolved via replaceParameters
        const url = replaceParameters(nodeData.url || '', params);
        const msg = { type: 'URL', text, url, created: new Date().toISOString() };
        messages.push(msg);
        addToHistory(session, msg, currentNodeId);
        
        // Check if this is the last node (no outgoing edges)
        const nextNode = findNextNode(currentNodeId, edges);
        if (!nextNode) {
          returnToMenu();
          return messages;
        }
        currentNodeId = nextNode;
        break;
      }

      case 'output_menu': {
        // Send text message first (if exists)
        const text = replaceParameters(nodeData.content || '', params);
        if (text) {
          const textMsg = { type: 'Text', text, created: new Date().toISOString() };
          messages.push(textMsg);
          addToHistory(session, textMsg, currentNodeId);
        }
        
        // Build options as {label, value, image_url} objects per the API spec
        const rawOptions = nodeData.options || [];
        const rawImages = nodeData.optionImages || [];
        const options = rawOptions
          .filter(opt => opt !== 'default')
          .map((opt, i) => {
            const label = String(opt);
            const obj = { label, value: label };
            const img = rawImages[i];
            if (img) obj.image_url = img;
            return obj;
          });
        
        const optionsMsg = { type: 'Options', options, created: new Date().toISOString() };
        messages.push(optionsMsg);
        addToHistory(session, optionsMsg, currentNodeId);
        
        // Stop here and wait for user selection
        session.current_node_id = currentNodeId;
        session.waiting_text_input = false;
        return messages;
      }

      case 'input_text':
      case 'input_date':
      case 'input_file': {
        // Send prompt if exists
        if (nodeData.label) {
          const text = replaceParameters(nodeData.label, params);
          const msg = { type: 'Text', text, created: new Date().toISOString() };
          messages.push(msg);
          addToHistory(session, msg, currentNodeId);
        }
        
        // Stop and wait for input
        session.current_node_id = currentNodeId;
        session.waiting_text_input = true;
        return messages;
      }

      case 'action_wait': {
        const waitTime = parseInt(nodeData.waitTime) || 1;
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        currentNodeId = findNextNode(currentNodeId, edges);
        break;
      }

      case 'action_time_routing': {
        // Get current hour in Israel timezone (handles DST automatically)
        const now = new Date();
        const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
        const israelHour = israelTime.getHours();
        
        // Check time ranges
        const timeRanges = nodeData.timeRanges || [];
        let matchedIndex = -1;
        
        for (let i = 0; i < timeRanges.length; i++) {
          const range = timeRanges[i];
          const fromHour = parseInt(range.fromHour) || 0;
          const toHour = parseInt(range.toHour) || 23;
          
          // Check if current hour is within range
          // Handle ranges that cross midnight (e.g., 22-8 means 22:00-07:59)
          let inRange = false;
          if (fromHour <= toHour) {
            // Normal range (e.g., 8-16)
            inRange = israelHour >= fromHour && israelHour < toHour;
          } else {
            // Range crosses midnight (e.g., 22-8)
            inRange = israelHour >= fromHour || israelHour < toHour;
          }
          
          if (inRange) {
            matchedIndex = i;
            break;
          }
        }
        
        // Route to matched option or default
        if (matchedIndex >= 0) {
          currentNodeId = findNextNode(currentNodeId, edges, `option-${matchedIndex}`);
        } else {
          currentNodeId = findNextNode(currentNodeId, edges, 'option-default');
        }
        break;
      }

      case 'action_web_service': {
        // If we're continuing from a previous webservice call with user input
        const userInput = session.waiting_webservice ? session.last_user_input : null;
        
        // Call webservice
        const wsResult = await handleWebService(node, session, userInput);
        
        // Add messages to response
        messages.push(...wsResult.messages);
        wsResult.messages.forEach(msg => addToHistory(session, msg, currentNodeId));
        
        // If waiting for input, stop here (even if this is the last node)
        if (wsResult.waitingInput) {
          session.current_node_id = currentNodeId;
          session.waiting_webservice = true;
          session.waiting_text_input = true;
          return messages;
        }

        // If Goto action: navigate to node by label
        if (wsResult.gotoLabel) {
          const gotoNode = nodes.find(n => n.data.label === wsResult.gotoLabel);
          if (gotoNode) {
            console.log(`[BOT] Goto node "${wsResult.gotoLabel}" (${gotoNode.id})`);
            session.waiting_webservice = false;
            currentNodeId = gotoNode.id;
            break;
          }
          console.warn(`[BOT] Goto target not found: "${wsResult.gotoLabel}"`);
        }
        
        // If we have a return value, find matching option
        if (wsResult.returnValue !== null && wsResult.returnValue !== undefined) {
          const matchedIdx = findMatchingOption(node, wsResult.returnValue);
          if (matchedIdx !== -1) {
            currentNodeId = findNextNode(currentNodeId, edges, `option-${matchedIdx}`);
            session.waiting_webservice = false;
            break;
          }
        }
        
        // No match or no return value - take default exit
        session.waiting_webservice = false;
        const nextNode = findNextNode(currentNodeId, edges, 'default');
        
        if (!nextNode) {
          returnToMenu();
          return messages;
        }
        
        currentNodeId = nextNode;
        break;
      }

      case 'fixed_process': {
        // Load subprocess
        const processId = nodeData.processId;
        if (processId) {
          const subFlow = await getFlowData(flowId, processId);
          const startNode = subFlow.nodes.find(n => n.type === 'start');
          
          if (startNode) {
            // Save parent context
            const stack = session.execution_stack || [];
            stack.push({ nodeId: currentNodeId, returnTo: findNextNode(currentNodeId, edges) });
            session.execution_stack = stack;
            
            // Process subprocess
            const subMessages = await walkChain(startNode.id, subFlow.nodes, subFlow.edges, session, flowId, req);
            messages.push(...subMessages);
            
            // If subprocess finished, return to parent
            if (!session.waiting_text_input && !session.waiting_webservice) {
              const returnTo = stack.pop()?.returnTo;
              session.execution_stack = stack;
              currentNodeId = returnTo;
            } else {
              return messages;
            }
          }
        } else {
          currentNodeId = findNextNode(currentNodeId, edges);
        }
        break;
      }

      default:
        currentNodeId = findNextNode(currentNodeId, edges);
    }
  }

  // End of chain
  if (depth >= maxDepth) {
    console.error('[BOT] ⚠️ Max depth reached');
  } else if (!currentNodeId) {
    returnToMenu();
  }
  
  return messages;
};

// Main API endpoint
export const respondToMessage = async (req, res) => {
  try {
    // Support both GET (query params) and POST (body) requests
    const isGetRequest = req.method === 'GET';
    const source = isGetRequest ? req.query : req.body;
    
    const { phone, text = '', sender = 'unknown', token: tokenParam, bot_id } = source;
    const token = req.headers.authorization?.replace('Bearer ', '') || tokenParam;

    console.log(`[BOT] ← ${req.method} | phone=${phone} sender=${sender} text="${String(text).substring(0, 40)}"`)

    if (!phone || !token) {
      return res.status(400).json({ 
        StatusId: 0, 
        StatusDescription: 'Missing phone or token' 
      });
    }

    // Find user by public_id (used as the API token)
    const user = await User.findOne({ public_id: token });
    if (!user) {
      return res.status(404).json({ 
        StatusId: 0, 
        StatusDescription: 'User not found' 
      });
    }

    // Find or create session
    let session = await BotSession.findOne({
      sender,
      is_active: true
    }).sort({ updatedAt: -1 });

    let isNewSession = false;
    let messages = [];
    let control = null;

    // Check if session exists and is within 15 minutes
    if (session) {
      const diffMinutes = (new Date() - new Date(session.updatedAt)) / (1000 * 60);
      if (diffMinutes > 15) {
        console.log(`[BOT] session expired (${diffMinutes.toFixed(1)} min) - resetting`);
        session.is_active = false;
        await session.save();
        session = null;
      } else {
        // Update sender and phone if changed
        if (session.sender !== sender) {
          session.sender = sender;
        }
        if (session.customer_phone !== phone) {
          session.customer_phone = phone;
        }
        // Merge botParams into existing session if missing (handles sessions created before this fix)
        try {
          const existingBot = await BotFlow.findById(session.flow_id);
          if (existingBot && existingBot.botParams) {
            const existingParams = session.parameters || {};
            const enriched = { ...existingParams };
            let changed = false;
            const applyBotParams = (map) => {
              if (typeof map.forEach === 'function') {
                map.forEach((val, key) => { if (enriched[key] === undefined) { enriched[key] = val; changed = true; } });
              } else if (typeof map === 'object') {
                Object.keys(map).forEach(key => { if (enriched[key] === undefined) { enriched[key] = map[key]; changed = true; } });
              }
            };
            applyBotParams(existingBot.botParams);
            if (changed) {
              session.parameters = enriched;
              session.markModified('parameters');
            }
          }
        } catch(e) {
          console.error('[BOT] Failed to enrich existing session with botParams:', e);
        }
      }
    }

    // Create new session if needed
    if (!session) {
      console.log('[BOT] creating new session');
      let bot;
      
      // If bot_id provided, use that specific bot
      if (bot_id) {
        bot = await BotFlow.findOne({ _id: bot_id, user_id: user._id });
        if (!bot) {
          return res.status(404).json({ 
            StatusId: 0, 
            StatusDescription: 'Bot not found or does not belong to user' 
          });
        }
      } else {
        // No bot_id provided - use default bot
        bot = await BotFlow.findOne({ user_id: user._id, is_default: true });
        
        if (!bot) {
          // No default bot - use first bot
          const userBots = await BotFlow.find({ user_id: user._id });
          if (userBots.length === 0) {
            return res.status(404).json({ 
              StatusId: 0, 
              StatusDescription: 'No bots found for user' 
            });
          }
          bot = userBots[0];
        }
      }
      
      const flowData = await getFlowData(bot._id);

      // Find automatic_responses node
      const autoResponseNode = flowData.nodes.find(n => n.type === 'automatic_responses');
      
      if (!autoResponseNode) {
        console.error('[BOT] ❌ No automatic_responses node found for bot:', bot._id);
        return res.status(404).json({ 
          StatusId: 0, 
          StatusDescription: 'No automatic responses configured' 
        });
      }

      // Merge bot-level template params (filled in the web form) into the session
      // so that --variableName-- placeholders are resolved in all nodes.
      const botParamsObj = {};
      if (bot.botParams) {
        try {
          if (typeof bot.botParams.forEach === 'function') {
            // Mongoose Map
            bot.botParams.forEach((val, key) => { botParamsObj[key] = val; });
          } else if (typeof bot.botParams === 'object') {
            Object.assign(botParamsObj, bot.botParams);
          }
        } catch (e) {
          console.error('[BOT] Failed to extract botParams:', e);
        }
      }

      console.log(`[BOT] bot selected: "${bot.name}" (${bot._id})`);
      session = await BotSession.create({
        user_id: user._id,
        flow_id: bot._id.toString(),
        customer_phone: phone,
        sender,
        current_node_id: autoResponseNode.id,
        is_active: true,
        parameters: { ...botParamsObj, waPhone: sender },
        process_history: []
      });

      isNewSession = true;
    }

    // Save user message to history
    if (text && !isNewSession) {
      addToHistory(session, { type: 'UserInput', text }, 'user');
      session.last_user_input = text; // Save for webservice
    }

    // Load current flow
    const flowData = await getFlowData(session.flow_id);
    let currentNode = flowData.nodes.find(n => n.id === session.current_node_id);

    // If the node is not found in the main flow, it may be inside a fixed_process sub-flow.
    // This happens when an input_text is the last node inside a fixed_process.
    let subFlowContext = null; // { nodes, edges, returnTo }
    if (!currentNode && session.waiting_text_input && (session.execution_stack || []).length > 0) {
      const stack = session.execution_stack;
      const lastEntry = stack[stack.length - 1];
      // lastEntry.nodeId is the fixed_process node in the parent (main) flow
      const fpNode = flowData.nodes.find(n => n.id === lastEntry.nodeId);
      if (fpNode && fpNode.data && fpNode.data.processId) {
        const subFlow = await getFlowData(session.flow_id, fpNode.data.processId);
        const nodeInSub = subFlow.nodes.find(n => n.id === session.current_node_id);
        if (nodeInSub) {
          currentNode = nodeInSub;
          subFlowContext = { nodes: subFlow.nodes, edges: subFlow.edges, returnTo: lastEntry.returnTo };
          console.log(`[BOT] 🔁 Node found in sub-flow (processId=${fpNode.data.processId}), returnTo=${lastEntry.returnTo}`);
        }
      }
    }

    if (!currentNode) {
      console.error('[BOT] ❌ Current node not found:', session.current_node_id);
      return res.status(404).json({ 
        StatusId: 0, 
        StatusDescription: 'Current node not found' 
      });
    }
    console.log(`[BOT] node=${currentNode.type} (${currentNode.id}) | newSession=${isNewSession} | waitText=${session.waiting_text_input} | waitWS=${session.waiting_webservice}`);

    const params = session.parameters || {};

    // ── Flow interrupt (mirrors Simulator flow-interrupt) ──────────────────────
    // If we are mid-flow (not a new session, not already at automatic_responses,
    // ── Flow interrupt ────────────────────────────────────────────────────────
    // Mirrors the simulator: any message that matches an option from a previously
    // shown menu (output_menu) or automatic_responses jumps back to that node,
    // even if the flow has already advanced or ended.
    // Fired whenever we are NOT explicitly waiting for free-text input.
    if (!isNewSession && text && !session.waiting_text_input) {

      // 1. Check all output_menu nodes in the flow for a match
      const interruptMenuNodes = flowData.nodes.filter(n => n.type === 'output_menu');
      for (const menuNode of interruptMenuNodes) {
        const menuOptions = (menuNode.data.options || []).filter(o => o !== 'default');
        const matchedMenuIdx = menuOptions.findIndex(
          opt => String(opt).trim().toLowerCase() === text.trim().toLowerCase()
        );
        if (matchedMenuIdx !== -1) {
          console.log(`[BOT] ⚡ interrupt: output_menu "${menuNode.id}" option ${matchedMenuIdx}`);
            session.execution_stack    = [];
          session.markModified('execution_stack');
          session.waiting_webservice = false;
          session.waiting_text_input = false;

          // Save the newly selected option to session parameters
          if (menuNode.data.variableName) {
            const interruptParams = session.parameters || {};
            interruptParams[menuNode.data.variableName] = text.trim();
            session.parameters = interruptParams;
            session.markModified('parameters');
          }

          const interruptNextId = findNextNode(menuNode.id, flowData.edges, `option-${matchedMenuIdx}`);
          if (interruptNextId) {
            addToHistory(session, { type: 'UserInput', text }, 'user');
            messages = await walkChain(interruptNextId, flowData.nodes, flowData.edges, session, session.flow_id, req);
            await session.save();
            return res.json({ StatusId: 1, StatusDescription: 'Success', sender, messages, control: null });
          }
        }
      }

      // 2. Check automatic_responses options (only when not already at automatic_responses)
      if (currentNode.type !== 'automatic_responses') {
        const autoNode = flowData.nodes.find(n => n.type === 'automatic_responses');
        if (autoNode) {
          const arOptions   = autoNode.data.options         || [];
          const arOperators = autoNode.data.optionOperators || arOptions.map(() => 'eq');

          let interruptIdx = -1;
          for (let i = 1; i < arOptions.length; i++) {
            if (evaluateCondition(arOperators[i], text, arOptions[i])) {
              interruptIdx = i;
              break;
            }
          }

          if (interruptIdx !== -1) {
            console.log(`[BOT] ⚡ interrupt: automatic_responses option ${interruptIdx}`);
            session.execution_stack    = [];
            session.markModified('execution_stack');
            session.waiting_webservice = false;
            session.waiting_text_input = false;

            const interruptNextId = findNextNode(autoNode.id, flowData.edges, `option-${interruptIdx}`);
            if (interruptNextId) {
              addToHistory(session, { type: 'UserInput', text }, 'user');
              messages = await walkChain(interruptNextId, flowData.nodes, flowData.edges, session, session.flow_id, req);
              await session.save();
              return res.json({ StatusId: 1, StatusDescription: 'Success', sender, messages, control: null });
            }
          }
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Handle based on current node type
    if (isNewSession && currentNode.type === 'automatic_responses') {
      // Match user message to options
      const options = currentNode.data.options || [];
      const operators = currentNode.data.optionOperators || options.map(() => 'eq');
      
      let matchedIdx = -1;
      for (let i = 1; i < options.length; i++) {
        const matches = evaluateCondition(operators[i], text, options[i]);
        if (matches) {
          matchedIdx = i;
          break;
        }
      }
      
      // Default to first option (כניסה) if no match
      const finalIdx = matchedIdx !== -1 ? matchedIdx : 0;
      const nextNodeId = findNextNode(currentNode.id, flowData.edges, `option-${finalIdx}`);
      if (nextNodeId) {
        messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
      }
    } else if (session.waiting_webservice && currentNode.type === 'action_web_service') {
      // User is responding to a webservice InputText request
      
      // Save user input
      session.last_user_input = text;
      
      // Re-call the webservice with the user input
      messages = await walkChain(currentNode.id, flowData.nodes, flowData.edges, session, session.flow_id, req);
    } else if (currentNode.type === 'input_text' || currentNode.type === 'input_date' || currentNode.type === 'input_file') {
      // We received the answer — no longer waiting
      session.waiting_text_input = false;

      // Save input to parameters
      const varName = currentNode.data.variableName;
      if (varName) {
        params[varName] = text;
        session.parameters = params;
        session.markModified('parameters');
      }

      // Use sub-flow edges if the node lives inside a fixed_process
      const activeNodes = subFlowContext ? subFlowContext.nodes : flowData.nodes;
      const activeEdges = subFlowContext ? subFlowContext.edges : flowData.edges;

      const nextNodeId = findNextNode(currentNode.id, activeEdges);
      if (nextNodeId) {
        // There is a next node inside the same (sub-)flow — continue normally
        messages = await walkChain(nextNodeId, activeNodes, activeEdges, session, session.flow_id, req);
      } else if (subFlowContext) {
        // Last node in sub-flow — pop execution stack and continue in parent flow
        const newStack = [...session.execution_stack];
        newStack.pop();
        session.execution_stack = newStack;
        session.markModified('execution_stack');
        if (subFlowContext.returnTo) {
          console.log(`[BOT] 🔁 Sub-flow input done, returning to parent node: ${subFlowContext.returnTo}`);
          messages = await walkChain(subFlowContext.returnTo, flowData.nodes, flowData.edges, session, session.flow_id, req);
        } else {
          // No return node — go back to main menu
          const autoNode = flowData.nodes.find(n => n.type === 'automatic_responses');
          if (autoNode) {
            session.current_node_id   = autoNode.id;
            session.waiting_webservice = false;
            session.execution_stack   = [];
            session.markModified('execution_stack');
          } else {
            session.is_active       = false;
            session.current_node_id = null;
          }
        }
      } else {
        // Last node in main flow — return to main menu or close session
        const autoNode = flowData.nodes.find(n => n.type === 'automatic_responses');
        if (autoNode) {
          session.current_node_id   = autoNode.id;
          session.waiting_webservice = false;
          session.execution_stack   = [];
          session.markModified('execution_stack');
        } else {
          session.is_active         = false;
          session.current_node_id   = null;
        }
      }
    } else if (currentNode.type === 'output_menu') {
      // Handle menu selection
      const selectedValue = text.trim();
      const options = currentNode.data.options || [];
      const selectedIdx = options.findIndex(opt => opt.trim() === selectedValue);
      
      if (selectedIdx !== -1) {
        // Save selection to parameters if menu has a variable name
        if (currentNode.data.variableName) {
          params[currentNode.data.variableName] = selectedValue;
          session.parameters = params;
          session.markModified('parameters');
        }
        
        const nextNodeId = findNextNode(currentNode.id, flowData.edges, `option-${selectedIdx}`);
        if (nextNodeId) {
          messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
        }
      } else {
        messages.push({ 
          type: 'Text', 
          text: '⚠️ לא נמצאה אפשרות תואמת לתשובה שלך.',
          created: new Date().toISOString()
        });
      }
    } else if (currentNode.type === 'automatic_responses' && !isNewSession) {
      // Re-match on automatic responses
      const options = currentNode.data.options || [];
      const operators = currentNode.data.optionOperators || options.map(() => 'eq');
      
      let matchedIdx = -1;
      for (let i = 1; i < options.length; i++) {
        const matches = evaluateCondition(operators[i], text, options[i]);
        if (matches) {
          matchedIdx = i;
          break;
        }
      }
      
      const finalIdx = matchedIdx !== -1 ? matchedIdx : 0;
      const nextNodeId = findNextNode(currentNode.id, flowData.edges, `option-${finalIdx}`);
      if (nextNodeId) {
        messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
      }
    }

    // Save session
    await session.save();

    // Build control object if needed
    // Reload the waiting node from the updated session.current_node_id (may have changed inside walkChain)
    const waitingNode = flowData.nodes.find(n => n.id === session.current_node_id);
    if (session.waiting_text_input && waitingNode?.data?.variableName) {
      control = {
        type: 'InputText',
        name: waitingNode.data.variableName
      };
    }

    console.log(`[BOT] → ${messages.length} messages | node=${session.current_node_id} | active=${session.is_active}`);
    return res.json({
      StatusId: 1,
      StatusDescription: 'Success',
      sender,
      messages,
      control
    });

  } catch (error) {
    console.error('[BOT] Error:', error);
    return res.status(500).json({
      StatusId: 0,
      StatusDescription: error.message
    });
  }
};
