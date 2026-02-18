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
    query.standard_process_id = processId;
    query.isStandardProcess = 0;
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

  console.log('[getFlowData] Query:', JSON.stringify(query), 'flowIdStr:', flowIdStr);
  const widgets = await Widget.find(query);
  console.log(`[getFlowData] Found ${widgets.length} widgets:`, widgets.map(w => ({ id: w.id, type: w.type, flow_id: w.flow_id })));
  
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
        processId: w.standard_process_id,
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
  history.push({
    ...message,
    node_id: nodeId,
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

  while (currentNodeId && depth < maxDepth) {
    depth++;
    
    const node = nodes.find(n => n.id === currentNodeId);
    if (!node) break;

    const nodeType = node.type;
    const nodeData = node.data;
    const params = session.parameters || {};

    console.log(`[BOT] Processing node ${currentNodeId}, type: ${nodeType}`);

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
          console.log('[BOT] ✅ Last node reached - closing session immediately');
          session.is_active = false;
          session.current_node_id = null;
          session.waiting_text_input = false;
          await session.save();
          console.log('[BOT] ✅ Session saved as inactive');
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
          console.log('[BOT] ✅ Last node (media) reached - closing session immediately');
          session.is_active = false;
          session.current_node_id = null;
          session.waiting_text_input = false;
          await session.save();
          console.log('[BOT] ✅ Session saved as inactive after media');
          return messages;
        }
        currentNodeId = nextNode;
        break;
      }

      case 'output_link': {
        const text = replaceParameters(nodeData.linkLabel || 'קישור', params);
        const url = replaceParameters(nodeData.url || '', params);
        const msg = { type: 'URL', text, url, created: new Date().toISOString() };
        messages.push(msg);
        addToHistory(session, msg, currentNodeId);
        
        // Check if this is the last node (no outgoing edges)
        const nextNode = findNextNode(currentNodeId, edges);
        if (!nextNode) {
          console.log('[BOT] ✅ Last node (link) reached - closing session immediately');
          session.is_active = false;
          session.current_node_id = null;
          session.waiting_text_input = false;
          await session.save();
          console.log('[BOT] ✅ Session saved as inactive after link');
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
        
        // Then send options menu (array of strings, not objects)
        const options = (nodeData.options || [])
          .filter(opt => opt !== 'default')
          .map(opt => String(opt));
        
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
        console.log(`[BOT] Waiting ${waitTime} seconds`);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        currentNodeId = findNextNode(currentNodeId, edges);
        break;
      }

      case 'action_time_routing': {
        // Get current hour in Israel timezone (handles DST automatically)
        const now = new Date();
        const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
        const israelHour = israelTime.getHours();
        
        console.log(`[BOT] Time routing - current Israel hour: ${israelHour}`);
        
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
            console.log(`[BOT] Matched time range ${i}: ${fromHour}-${toHour}`);
            break;
          }
        }
        
        // Route to matched option or default
        if (matchedIndex >= 0) {
          currentNodeId = findNextNode(currentNodeId, edges, `option-${matchedIndex}`);
        } else {
          console.log(`[BOT] No time range matched, using default route`);
          currentNodeId = findNextNode(currentNodeId, edges, 'option-default');
        }
        break;
      }

      case 'action_web_service': {
        console.log('[BOT] 🌐 Web service node - calling API');
        
        // If we're continuing from a previous webservice call with user input
        const userInput = session.waiting_webservice ? session.last_user_input : null;
        console.log('[BOT] 🌐 User input for WS:', userInput);
        console.log('[BOT] 🌐 Session before WS call:', {
          waiting_webservice: session.waiting_webservice,
          waiting_text_input: session.waiting_text_input,
          current_node: session.current_node_id
        });
        
        // Call webservice
        const wsResult = await handleWebService(node, session, userInput);
        
        console.log('[BOT] 🌐 WS Result received:', {
          messageCount: wsResult.messages.length,
          messageTypes: wsResult.messages.map(m => m.type),
          returnValue: wsResult.returnValue,
          waitingInput: wsResult.waitingInput
        });
        
        // Add messages to response
        messages.push(...wsResult.messages);
        wsResult.messages.forEach(msg => addToHistory(session, msg, currentNodeId));
        
        // If waiting for input, stop here (even if this is the last node)
        if (wsResult.waitingInput) {
          console.log('[BOT] ⏸️ Web service waiting for input - session stays active');
          console.log('[BOT] ⏸️ Setting session state:', {
            current_node_id: currentNodeId,
            waiting_webservice: true,
            waiting_text_input: true
          });
          session.current_node_id = currentNodeId;
          session.waiting_webservice = true;
          session.waiting_text_input = true;
          console.log('[BOT] ⏸️ Returning', messages.length, 'messages');
          return messages;
        }
        
        // If we have a return value, find matching option
        if (wsResult.returnValue !== null && wsResult.returnValue !== undefined) {
          const matchedIdx = findMatchingOption(node, wsResult.returnValue);
          if (matchedIdx !== -1) {
            console.log(`[BOT] ✅ Return value matched option ${matchedIdx} - taking conditional exit`);
            currentNodeId = findNextNode(currentNodeId, edges, `option-${matchedIdx}`);
            session.waiting_webservice = false;
            break;
          }
        }
        
        // No match or no return value - take default exit
        console.log('[BOT] ✅ No match - taking default exit');
        session.waiting_webservice = false;
        const nextNode = findNextNode(currentNodeId, edges, 'default');
        
        if (!nextNode) {
          // No default exit - close session
          console.log('[BOT] ⚠️ No default exit found - closing session');
          session.is_active = false;
          session.current_node_id = null;
          session.waiting_text_input = false;
          await session.save();
          return messages;
        }
        
        currentNodeId = nextNode;
        break;
      }

      case 'fixed_process': {
        // Load subprocess
        const processId = nodeData.processId;
        if (processId) {
          console.log(`[BOT] Entering fixed process ${processId}`);
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
        console.log(`[BOT] Unknown node type: ${nodeType}`);
        currentNodeId = findNextNode(currentNodeId, edges);
    }
  }

  // End of chain
  if (depth >= maxDepth) {
    console.log('[BOT] ⚠️ Max depth reached');
  } else if (!currentNodeId) {
    console.log('[BOT] ✅ End of flow reached - closing session immediately');
    session.is_active = false;
    session.current_node_id = null;
    session.waiting_text_input = false;
    await session.save();
    console.log('[BOT] ✅ Session saved as inactive at end of flow');
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

    console.log('[BOT] Incoming request:', { phone, sender, text: text.substring(0, 50) });

    if (!phone || !token) {
      return res.status(400).json({ 
        StatusId: 0, 
        StatusDescription: 'Missing phone or token' 
      });
    }

    // Find user by token
    const user = await User.findOne({ token });
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
      console.log(`[BOT] Found existing session - age: ${diffMinutes.toFixed(2)} minutes`);
      
      if (diffMinutes > 15) {
        console.log('[BOT] Session expired (>15 min), closing and will create new one');
        session.is_active = false;
        await session.save();
        session = null;
      } else {
        console.log(`[BOT] Using existing session - bot: ${session.flow_id}, sender: ${session.sender}`);
        // Update sender and phone if changed
        if (session.sender !== sender) {
          console.log(`[BOT] Updating sender from ${session.sender} to ${sender}`);
          session.sender = sender;
        }
        if (session.customer_phone !== phone) {
          console.log(`[BOT] Updating phone from ${session.customer_phone} to ${phone}`);
          session.customer_phone = phone;
        }
      }
    }

    // Create new session if needed
    if (!session) {
      console.log('[BOT] Creating new session');
      
      let bot;
      
      // If bot_id provided, use that specific bot
      if (bot_id) {
        console.log('[BOT] Looking for specific bot_id:', bot_id);
        bot = await BotFlow.findOne({ _id: bot_id, user_id: user._id });
        if (!bot) {
          return res.status(404).json({ 
            StatusId: 0, 
            StatusDescription: 'Bot not found or does not belong to user' 
          });
        }
        console.log('[BOT] Using specified bot:', { id: bot._id, name: bot.name });
      } else {
        // No bot_id provided - use default bot
        console.log('[BOT] No bot_id provided, looking for default bot');
        bot = await BotFlow.findOne({ user_id: user._id, is_default: true });
        
        if (!bot) {
          // No default bot - use first bot
          console.log('[BOT] No default bot found, using first bot');
          const userBots = await BotFlow.find({ user_id: user._id });
          if (userBots.length === 0) {
            return res.status(404).json({ 
              StatusId: 0, 
              StatusDescription: 'No bots found for user' 
            });
          }
          bot = userBots[0];
        }
        console.log('[BOT] Using bot:', { id: bot._id, name: bot.name, is_default: bot.is_default });
      }
      console.log('[BOT] Using bot:', { id: bot._id, id_string: bot._id.toString(), name: bot.name });
      
      // First, let's check what flow_ids exist in widgets
      const allBotWidgets = await Widget.find({ user_id: user._id.toString() }).limit(5);
      console.log('[BOT] Sample widgets for user:', allBotWidgets.map(w => ({ id: w.id, type: w.type, flow_id: w.flow_id })));
      
      const flowData = await getFlowData(bot._id);
      console.log('[BOT] Flow data loaded:', { 
        nodesCount: flowData.nodes.length, 
        nodeTypes: flowData.nodes.map(n => n.type)
      });

      // Find automatic_responses node
      const autoResponseNode = flowData.nodes.find(n => n.type === 'automatic_responses');
      
      if (!autoResponseNode) {
        console.log('[BOT] ❌ No automatic_responses node found!');
        return res.status(404).json({ 
          StatusId: 0, 
          StatusDescription: 'No automatic responses configured' 
        });
      }
      
      console.log('[BOT] ✅ Found automatic_responses node:', autoResponseNode.id);

      session = await BotSession.create({
        user_id: user._id,
        flow_id: bot._id.toString(),
        customer_phone: phone,
        sender,
        current_node_id: autoResponseNode.id,
        is_active: true,
        parameters: {},
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
    console.log('[BOT] Loading flow data for session:', {
      flow_id: session.flow_id,
      flow_id_type: typeof session.flow_id,
      current_node: session.current_node_id,
      isNewSession
    });
    const flowData = await getFlowData(session.flow_id);
    console.log('[BOT] Flow loaded:', {
      nodesCount: flowData.nodes.length,
      nodeIds: flowData.nodes.map(n => n.id)
    });
    
    const currentNode = flowData.nodes.find(n => n.id === session.current_node_id);

    if (!currentNode) {
      console.log('[BOT] ❌ Current node not found!', {
        looking_for: session.current_node_id,
        available_nodes: flowData.nodes.map(n => ({ id: n.id, type: n.type }))
      });
      return res.status(404).json({ 
        StatusId: 0, 
        StatusDescription: 'Current node not found' 
      });
    }
    
    console.log('[BOT] Current node found:', {
      id: currentNode.id,
      type: currentNode.type,
      options: currentNode.data.options
    });

    const params = session.parameters || {};

    // Handle based on current node type
    if (isNewSession && currentNode.type === 'automatic_responses') {
      // Match user message to options
      const options = currentNode.data.options || [];
      const operators = currentNode.data.optionOperators || options.map(() => 'eq');
      
      console.log('[BOT] Matching text for new session:', {
        text,
        options,
        operators
      });
      
      let matchedIdx = -1;
      for (let i = 1; i < options.length; i++) {
        const matches = evaluateCondition(operators[i], text, options[i]);
        console.log(`[BOT] Testing option ${i}: "${options[i]}" with operator "${operators[i]}" => ${matches}`);
        if (matches) {
          matchedIdx = i;
          break;
        }
      }
      
      // Default to first option (כניסה) if no match
      const finalIdx = matchedIdx !== -1 ? matchedIdx : 0;
      console.log(`[BOT] Final matched index: ${finalIdx} (option: "${options[finalIdx]}")`);
      
      const nextNodeId = findNextNode(currentNode.id, flowData.edges, `option-${finalIdx}`);
      console.log(`[BOT] Next node ID: ${nextNodeId}`);
      
      if (nextNodeId) {
        messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
      }
    } else if (session.waiting_webservice && currentNode.type === 'action_web_service') {
      // User is responding to a webservice InputText request
      console.log('[BOT] Handling webservice InputText response');
      
      // Save user input
      session.last_user_input = text;
      
      // Re-call the webservice with the user input
      messages = await walkChain(currentNode.id, flowData.nodes, flowData.edges, session, session.flow_id, req);
    } else if (currentNode.type === 'input_text' || currentNode.type === 'input_date' || currentNode.type === 'input_file') {
      // Save input to parameters
      const varName = currentNode.data.variableName;
      if (varName) {
        params[varName] = text;
        session.parameters = params;
      }
      
      const nextNodeId = findNextNode(currentNode.id, flowData.edges);
      if (nextNodeId) {
        messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
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
      
      console.log('[BOT] Re-matching text on automatic_responses:', {
        text,
        options,
        operators
      });
      
      let matchedIdx = -1;
      for (let i = 1; i < options.length; i++) {
        const matches = evaluateCondition(operators[i], text, options[i]);
        console.log(`[BOT] Testing option ${i}: "${options[i]}" with operator "${operators[i]}" => ${matches}`);
        if (matches) {
          matchedIdx = i;
          break;
        }
      }
      
      const finalIdx = matchedIdx !== -1 ? matchedIdx : 0;
      console.log(`[BOT] Final matched index: ${finalIdx} (option: "${options[finalIdx]}")`);
      
      const nextNodeId = findNextNode(currentNode.id, flowData.edges, `option-${finalIdx}`);
      console.log(`[BOT] Next node ID: ${nextNodeId}`);
      
      if (nextNodeId) {
        messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
      }
    }

    // Save session
    await session.save();

    // Build control object if needed
    if (session.waiting_text_input && currentNode.data.variableName) {
      control = {
        type: 'InputText',
        name: currentNode.data.variableName
      };
    }

    console.log('[BOT] 📨 Final response:', {
      messageCount: messages.length,
      messageTypes: messages.map(m => m.type),
      control: control,
      session_state: {
        current_node_id: session.current_node_id,
        waiting_text_input: session.waiting_text_input,
        waiting_webservice: session.waiting_webservice,
        is_active: session.is_active
      }
    });

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
