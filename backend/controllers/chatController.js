import mongoose from 'mongoose';
import User from '../models/User.js';
import BotFlow from '../models/BotFlow.js';
import Widget from '../models/Widget.js';
import Option from '../models/Option.js';
import BotSession from '../models/BotSession.js';
import Contact from '../models/Contact.js';
import Group from '../models/Group.js';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
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

// Helper: Validate Israeli ID (9-digit Luhn-style checksum)
const validateIsraeliID = (id) => {
  const str = String(id).trim().replace(/[-\s]/g, '').padStart(9, '0');
  if (!/^\d{9}$/.test(str)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let val = parseInt(str[i]) * ((i % 2) + 1);
    if (val > 9) val -= 9;
    sum += val;
  }
  return sum % 10 === 0;
};

// Helper: Validate input by validation type
const validateInput = (type, value) => {
  const v = String(value || '').trim();
  switch (type) {
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    case 'phone': {
      const digits = v.replace(/[-\s()]/g, '');
      return /^(\+972|0)([5][0-9]{8}|[2-9][0-9]{7,8})$/.test(digits);
    }
    case 'id':
      return validateIsraeliID(v);
    case 'url':
      return /^https?:\/\/.+\..+/.test(v);
    default:
      return true;
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

    // Reconstruct timeRanges / dateRanges for action_time_routing
    if (w.type === 'action_time_routing') {
      const routingMode = metadata.routingMode || 'time';
      let ranges = {};
      if (routingMode === 'date') {
        ranges.dateRanges = nodeOptions
          .filter(o => o.operator === 'date_range')
          .map(o => {
            const [fromDate, toDate] = o.value.split('|');
            return { fromDate, toDate };
          });
      } else {
        ranges.timeRanges = nodeOptions
          .filter(o => o.operator === 'time_range')
          .map(o => {
            const [fromHour, toHour] = o.value.split('-').map(Number);
            return { fromHour, toHour };
          });
      }
      return {
        id: w.id,
        type: w.type,
        position: { x: w.pos_x, y: w.pos_y },
        data: { ...metadata, ...ranges }
      };
    }
    
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
        groupId: metadata.groupId,
        removeFromGroupMode: metadata.removeFromGroupMode,
        removeGroupId: metadata.removeGroupId,
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

    // Special handling for time routing: use correct sourceHandle names
    if (w.type === 'action_time_routing') {
      let rangeIndex = 0;
      wOptions.forEach((o) => {
        if (o.next) {
          const sourceHandle = o.operator === 'default' ? 'option-default' : `option-${rangeIndex}`;
          edges.push({ id: `e-${w.id}-${sourceHandle}-${o.next}`, source: w.id, sourceHandle, target: o.next });
        }
        if (o.operator === 'time_range' || o.operator === 'date_range') rangeIndex++;
      });
    } else {
      wOptions.forEach((o, i) => { 
        if (o.next) { 
          edges.push({ id: `e-${w.id}-opt-${i}`, source: w.id, sourceHandle: `option-${i}`, target: o.next }); 
        } 
      });
    }
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
        
        // Build options as simple string array
        const rawOptions = nodeData.options || [];
        const options = rawOptions
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
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
        currentNodeId = findNextNode(currentNodeId, edges);
        break;
      }

      case 'action_add_to_group': {
        const waPhone = session.parameters?.waPhone;
        // In simulator mode waPhone is absent or 'Simulated' — skip silently
        const isSimulated = !waPhone || waPhone === 'Simulated' || waPhone.toLowerCase() === 'simulator';
        if (!isSimulated && nodeData.groupId) {
          try {
            const userId = String(session.user_id);
            const group = await Group.findOne({ _id: nodeData.groupId, user_id: userId });
            if (group) {
              let contact = await Contact.findOne({ user_id: userId, phone: waPhone });
              if (!contact) {
                contact = await Contact.create({ user_id: userId, phone: waPhone });
              }
              const existing = new Set((group.contact_ids || []).map(String));
              existing.add(String(contact._id));
              group.contact_ids = Array.from(existing).map(id => new mongoose.Types.ObjectId(id));
              await group.save();
              console.log(`[BOT] ✅ Added ${waPhone} to group "${group.name}"`);
            } else {
              console.warn(`[BOT] action_add_to_group: group ${nodeData.groupId} not found`);
            }
          } catch (err) {
            console.error('[BOT] action_add_to_group error:', err.message);
          }
        } else {
          console.log(`[BOT] action_add_to_group: skipping (simulator or no groupId)`);
        }
        currentNodeId = findNextNode(currentNodeId, edges);
        break;
      }

      case 'action_remove_from_group': {
        const waPhone = session.parameters?.waPhone;
        const isSimulated = !waPhone || waPhone === 'Simulated' || waPhone.toLowerCase() === 'simulator';
        console.log(`[BOT] action_remove_from_group | waPhone=${waPhone} | isSimulated=${isSimulated} | mode=${nodeData.removeFromGroupMode} | removeGroupId=${nodeData.removeGroupId}`);
        if (!isSimulated) {
          const userId = String(session.user_id);
          const removeMode = nodeData.removeFromGroupMode || 'specific';
          try {
            if (removeMode === 'specific' && nodeData.removeGroupId) {
              // Remove contact from the specified group if present
              const group = await Group.findOne({ _id: nodeData.removeGroupId, user_id: userId });
              if (group) {
                const contact = await Contact.findOne({ user_id: userId, phone: waPhone });
                if (contact) {
                  const beforeCount = group.contact_ids.length;
                  group.contact_ids = group.contact_ids.filter(id => String(id) !== String(contact._id));
                  if (group.contact_ids.length < beforeCount) {
                    await group.save();
                    console.log(`[BOT] ✅ Removed ${waPhone} from group "${group.name}"`);
                  } else {
                    console.log(`[BOT] action_remove_from_group: ${waPhone} not found in group "${group.name}", skipping`);
                  }
                } else {
                  console.log(`[BOT] action_remove_from_group: contact ${waPhone} not found, skipping`);
                }
              } else {
                console.warn(`[BOT] action_remove_from_group: group ${nodeData.removeGroupId} not found`);
              }
            } else if (removeMode === 'all') {
              // Add waPhone to the blocklist (רשימת הסרה)
              let blocklist = await Group.findOne({ user_id: userId, is_blocklist: true });
              if (!blocklist) {
                blocklist = await Group.create({ user_id: userId, name: 'רשימת הסרה', is_blocklist: true, contact_ids: [], phones: [] });
              }
              // Find or create a Contact record so it shows up in the UI
              let contact = await Contact.findOne({ user_id: userId, phone: waPhone });
              if (!contact) {
                contact = await Contact.create({ user_id: userId, phone: waPhone });
              }
              // Add to both contact_ids and phones
              const result = await Group.updateOne(
                { _id: blocklist._id },
                {
                  $addToSet: {
                    phones: waPhone,
                    contact_ids: contact._id,
                  }
                }
              );
              if (result.modifiedCount > 0) {
                console.log(`[BOT] ✅ Added ${waPhone} to blocklist (רשימת הסרה)`);
              } else {
                console.log(`[BOT] action_remove_from_group: ${waPhone} already in blocklist`);
              }
            }
          } catch (err) {
            console.error('[BOT] action_remove_from_group error:', err.message);
          }
        } else {
          console.log(`[BOT] action_remove_from_group: skipping (simulator or no waPhone)`);
        }
        currentNodeId = findNextNode(currentNodeId, edges);
        break;
      }

      case 'action_time_routing': {
        // Get current date/time in Israel timezone (handles DST automatically)
        const now = new Date();
        const israelTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' }));
        const routingMode = nodeData.routingMode || 'time';

        let matchedIndex = -1;

        if (routingMode === 'date') {
          const israelDateStr = [
            israelTime.getFullYear(),
            String(israelTime.getMonth() + 1).padStart(2, '0'),
            String(israelTime.getDate()).padStart(2, '0'),
          ].join('-');

          const dateRanges = nodeData.dateRanges || [];
          for (let i = 0; i < dateRanges.length; i++) {
            const range = dateRanges[i];
            if (range.fromDate && range.toDate && israelDateStr >= range.fromDate && israelDateStr <= range.toDate) {
              matchedIndex = i;
              break;
            }
          }
        } else {
          const israelHour = israelTime.getHours();
          const timeRanges = nodeData.timeRanges || [];
          for (let i = 0; i < timeRanges.length; i++) {
            const range = timeRanges[i];
            const fromHour = parseInt(range.fromHour) || 0;
            const toHour = parseInt(range.toHour) || 23;

            let inRange = false;
            if (fromHour <= toHour) {
              inRange = israelHour >= fromHour && israelHour < toHour;
            } else {
              inRange = israelHour >= fromHour || israelHour < toHour;
            }

            if (inRange) {
              matchedIndex = i;
              break;
            }
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
          console.log(`[BOT] 🔄 WS returnValue=${wsResult.returnValue} — trying to match an option in node ${currentNodeId}`);
          const matchedIdx = findMatchingOption(node, wsResult.returnValue);
          if (matchedIdx !== -1) {
            const nextIdAfterWs = findNextNode(currentNodeId, edges, `option-${matchedIdx}`);
            console.log(`[BOT] ✅ Matched option-${matchedIdx} → next node: ${nextIdAfterWs}`);
            currentNodeId = nextIdAfterWs;
            session.waiting_webservice = false;
            break;
          }
        }
        
        // No match or no return value - take default exit
        session.waiting_webservice = false;
        const nextNode = findNextNode(currentNodeId, edges, 'default');
        console.log(`[BOT] ➡️ Taking default exit from WS node → next: ${nextNode}`);
        
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

// ─── Proactive WhatsApp push ──────────────────────────────────────────────────
// Sends bot messages directly to WhatsApp via the dialog360 /send endpoint.
// Handles all message types: Text, Options, Image, Video, Document, URL, SendItem.
// Returns true if pushed successfully, false if WHATSAPP_ENDPOINT is not configured.
const _sleep = (ms) => new Promise(r => setTimeout(r, ms));

const pushMessagesToWhatsApp = async (phone, messages) => {
  
  const endpoint = process.env.WHATSAPP_ENDPOINT || 'dialog360/65aec7ebf1a1d64f29645fd9';
  if (!endpoint || !messages.length) return false;

  // Normalize phone: strip non-digits, replace leading 0 with 972
  const normalizedPhone = String(phone).replace(/[^0-9]/g, '').replace(/^0/, '972').replace(/^972972/, '972');

  const waToken = process.env.WHATSAPP_API_TOKEN ||
    crypto.createHash('sha1').update(endpoint + 'moomoo').digest('hex');

  console.log(`[WA-PUSH] 📞 Sending to phone=${normalizedPhone} via endpoint=${endpoint}`);

  // Returns true on success, false on failure
  const sendOne = async (body) => {
    try {
      const res = await fetch(`https://wa.message.co.il/api/${endpoint}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Accept': 'application/json',
          'token': waToken,
        },
        body: JSON.stringify({ ...body, phone: normalizedPhone, fromMe: 1 }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error(`[WA-PUSH] ❌ HTTP ${res.status} | body: ${JSON.stringify(body).substring(0, 100)} | resp: ${errText.substring(0, 200)}`);
        return false;
      } else {
        const kind = body.image ? 'image' : body.video ? 'video' : body.file ? 'file' : body.buttons ? 'buttons' : 'text';
        console.log(`[WA-PUSH] ✅ Sent ${kind} to ${normalizedPhone}`);
        return true;
      }
    } catch (err) {
      console.error('[WA-PUSH] ❌ Exception:', err.message);
      return false;
    }
  };

  let textBuffer = '';
  let anySuccess = false;

  for (const msg of messages) {
    switch (msg.type) {
      case 'Text':
        if (msg.text) textBuffer += msg.text + '\n';
        break;

      case 'Options': {
        // Group accumulated text + options → buttons (≤3) or list (>3)
        const headerText = textBuffer.trim() || ' ';
        if (await sendOne({ text: headerText, buttons: msg.options })) anySuccess = true;
        textBuffer = '';
        await _sleep(400);
        break;
      }

      case 'Image': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        if (await sendOne({ image: msg.url, text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'Video': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        if (await sendOne({ video: msg.url, text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'Document': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        if (await sendOne({ file: msg.url, filename: msg.filename || 'file', text: msg.text || '' })) anySuccess = true;
        await _sleep(600);
        break;
      }

      case 'URL':
        // Append URL to text buffer — dialog360 linkifies plain URLs in text
        textBuffer += `${msg.text ? msg.text + '\n' : ''}${msg.url}\n`;
        break;

      case 'SendItem': {
        if (textBuffer.trim()) { if (await sendOne({ text: textBuffer.trim() })) anySuccess = true; textBuffer = ''; await _sleep(400); }
        const itemText = [msg.title, msg.subtitle].filter(Boolean).join('\n');
        const btnList = (msg.options || []).map(o =>
          typeof o === 'string' ? o : (o.label || o.text || o.value || String(o))
        );
        if (await sendOne(btnList.length > 0 ? { text: itemText, buttons: btnList } : { text: itemText })) anySuccess = true;
        await _sleep(400);
        break;
      }

      default:
        break;
    }
  }

  // Flush any remaining accumulated text
  if (textBuffer.trim()) {
    if (await sendOne({ text: textBuffer.trim() })) anySuccess = true;
  }

  // Only return true if at least one message was actually delivered.
  // If false, the caller will fall back to returning messages in the JSON response
  // so that dialog360 can handle sending via its own handleShamirResponse.
  console.log(`[WA-PUSH] 🏁 anySuccess=${anySuccess}`);
  return anySuccess;
};
// ─────────────────────────────────────────────────────────────────────────────

// Main API endpoint
export const respondToMessage = async (req, res) => {
  try {
    // Support both GET (query params) and POST (body) requests
    const isGetRequest = req.method === 'GET';
    const source = isGetRequest ? req.query : req.body;
    
    const { phone, text = '', sender = 'unknown', token: tokenParam, bot_id, name = '' } = source;
    const token = req.headers.authorization?.replace('Bearer ', '') || tokenParam;

    console.log(`[BOT] ← ${req.method} | phone=${phone} sender=${sender} text="${String(text).substring(0, 40)}"`)
    console.log(`[BOT] 🔍 DEBUG - phone: "${phone}", sender: "${sender}"`);
    console.log(`[BOT] 🔍 Searching for session with sender: "${sender}"`);

    if (!phone || !token) {
      return res.status(400).json({ 
        StatusId: 0, 
        StatusDescription: 'Missing phone or token' 
      });
    }

    // Find bot directly by its public_id (used as the API token)
    const tokenBot = await BotFlow.findOne({ public_id: token });
    if (!tokenBot) {
      return res.status(404).json({ 
        StatusId: 0, 
        StatusDescription: 'Bot not found' 
      });
    }
    const user = await User.findById(tokenBot.user_id);
    if (!user) {
      return res.status(404).json({ 
        StatusId: 0, 
        StatusDescription: 'User not found' 
      });
    }

    // ── Agent mode bypass ────────────────────────────────────────────────────
    // If a human agent has taken over this conversation (is_agent=true, activated
    // within the last 30 minutes), save the incoming message but suppress the bot.
    const agentCheckSession = await BotSession.findOne({
      $or: [{ sender }, { customer_phone: phone }],
      is_agent: true
    }).sort({ updatedAt: -1 });

    if (agentCheckSession) {
      const agentAgeMinutes = (Date.now() - new Date(agentCheckSession.agent_since).getTime()) / 60000;
      if (agentAgeMinutes <= 30) {
        // Active agent — record user message only, return empty bot response
        agentCheckSession.process_history = agentCheckSession.process_history || [];
        agentCheckSession.process_history.push({
          type: 'UserInput',
          text: String(text),
          sender: 'user',
          name: 'משתמש',
          node_id: 'user',
          created: new Date().toISOString()
        });
        agentCheckSession.markModified('process_history');
        await agentCheckSession.save();
        return res.json({ StatusId: 1, StatusDescription: 'Agent mode active', sender, messages: [], agentMode: true });
      } else {
        // Agent mode expired — clear it so the bot resumes normally
        agentCheckSession.is_agent = false;
        agentCheckSession.agent_since = null;
        await agentCheckSession.save();
        console.log('[BOT] Agent mode expired, resuming bot for', phone);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Find or create session
    let session = await BotSession.findOne({
      sender,
      is_active: true
    }).sort({ updatedAt: -1 });
    
    console.log(`[BOT] 🔎 Session search result: ${session ? 'FOUND' : 'NOT FOUND'}`);
    if (session) {
      console.log(`[BOT]    Session ID: ${session._id}`);
      console.log(`[BOT]    Session sender: "${session.sender}"`);
      console.log(`[BOT]    Session phone: "${session.customer_phone}"`);
    }

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
        console.log(`[BOT] 📝 Existing session found - BEFORE update:`);
        console.log(`[BOT]    DB sender: ${session.sender}, DB phone: ${session.customer_phone}`);
        console.log(`[BOT]    Request sender: ${sender}, Request phone: ${phone}`);
        
        // Update sender and phone if changed
        if (session.sender !== sender) {
          console.log(`[BOT] ⚠️  Updating sender from "${session.sender}" to "${sender}"`);
          session.sender = sender;
        }
        if (session.customer_phone !== phone) {
          console.log(`[BOT] ⚠️  Updating phone from "${session.customer_phone}" to "${phone}"`);
          session.customer_phone = phone;
        }
        
        console.log(`[BOT] 📝 AFTER update:`);
        console.log(`[BOT]    DB sender: ${session.sender}, DB phone: ${session.customer_phone}`);
        
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
      // Bot is already identified from the token (public_id)
      const bot = tokenBot;
      
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
        } catch(e) {
          console.error('[BOT] Failed to parse botParams for new session:', e);
        }
      }
      
      console.log(`[BOT] 🆕 Creating NEW session with:`);
      console.log(`[BOT]    customer_phone: "${phone}"`);
      console.log(`[BOT]    sender: "${sender}"`);
      
      // If WHATSAPP_BOT_ID env var is set, inject _simulatorId so that webservice
      // nodes whose URL contains --_simulatorId-- receive a valid value (instead of null).
      const waSimulatorId = process.env.WHATSAPP_BOT_ID || null;

      session = await BotSession.create({
        user_id: user._id,
        flow_id: bot._id.toString(),
        customer_phone: phone,
        sender,
        current_node_id: autoResponseNode.id,
        is_active: true,
        parameters: { ...botParamsObj, waPhone: sender, ...(waSimulatorId ? { _simulatorId: waSimulatorId } : {}) },
        process_history: []
      });
      
      console.log(`[BOT] ✅ Session created with ID: ${session._id}`);
      console.log(`[BOT]    Saved sender: "${session.sender}"`);
      console.log(`[BOT]    Saved phone: "${session.customer_phone}"`);

      // Auto-add contact — only for real WhatsApp numbers (not simulator)
      const isSimulatedPhone = !sender || sender === 'Simulated' || sender.toLowerCase() === 'simulator';
      if (!isSimulatedPhone && sender) {
        const contactSet = {};
        const contactSetOnInsert = { full_name: '', email: '' };
        // Always update whatsapp_name if a name was provided
        if (name && name.trim()) {
          contactSet.whatsapp_name = name.trim();
        } else {
          contactSetOnInsert.whatsapp_name = '';
        }
        const updateOp = Object.keys(contactSet).length > 0
          ? { $set: contactSet, $setOnInsert: contactSetOnInsert }
          : { $setOnInsert: { ...contactSetOnInsert, whatsapp_name: '' } };
        Contact.findOneAndUpdate(
          { user_id: String(user._id), phone: sender },
          updateOp,
          { upsert: true, new: true }
        ).catch(err => console.error('[BOT] Failed to upsert contact:', err.message));
      }

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

        // Determine which edge to follow: matched option or default
        const isCurrentMenuNode = menuNode.id === session.current_node_id;
        const useDefault = matchedMenuIdx === -1 && isCurrentMenuNode;
        const edgeHandle = matchedMenuIdx !== -1
          ? `option-${matchedMenuIdx}`
          : (useDefault ? 'option-default' : null);

        if (edgeHandle) {
          const interruptNextId = findNextNode(menuNode.id, flowData.edges, edgeHandle);
          if (interruptNextId) {
            if (matchedMenuIdx !== -1) {
              console.log(`[BOT] ⚡ interrupt: output_menu "${menuNode.id}" option ${matchedMenuIdx}`);
            } else {
              console.log(`[BOT] ⚡ interrupt: output_menu "${menuNode.id}" no match → option-default`);
            }
            session.execution_stack    = [];
            session.markModified('execution_stack');
            session.waiting_webservice = false;
            session.waiting_text_input = false;

            // Save the newly selected option to session parameters
            {
              const interruptParams = session.parameters || {};
              if (menuNode.data.variableName && matchedMenuIdx !== -1) {
                interruptParams[menuNode.data.variableName] = text.trim();
              }
              interruptParams['open'] = text.trim();
              session.parameters = interruptParams;
              session.markModified('parameters');
            }

            addToHistory(session, { type: 'UserInput', text }, 'user');
            messages = await walkChain(interruptNextId, flowData.nodes, flowData.edges, session, session.flow_id, req);
            await session.save();
            const waPushedInterrupt1 = await pushMessagesToWhatsApp(sender, messages);
            return res.json({ StatusId: 1, StatusDescription: 'Success', sender, messages: waPushedInterrupt1 ? [] : messages, control: null, ...(waPushedInterrupt1 && { wa_pushed: true }) });
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
            {
              const interruptParams = session.parameters || {};
              interruptParams['open'] = text.trim();
              session.parameters = interruptParams;
              session.markModified('parameters');
            }

            const interruptNextId = findNextNode(autoNode.id, flowData.edges, `option-${interruptIdx}`);
            if (interruptNextId) {
              addToHistory(session, { type: 'UserInput', text }, 'user');
              messages = await walkChain(interruptNextId, flowData.nodes, flowData.edges, session, session.flow_id, req);
              await session.save();
              const waPushedInterrupt2 = await pushMessagesToWhatsApp(sender, messages);
              return res.json({ StatusId: 1, StatusDescription: 'Success', sender, messages: waPushedInterrupt2 ? [] : messages, control: null, ...(waPushedInterrupt2 && { wa_pushed: true }) });
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
      
      console.log(`[BOT] 🆕 NEW SESSION - matching "${text}" against options:`, options);

      let matchedIdx = -1;
      for (let i = 1; i < options.length; i++) {
        const matches = evaluateCondition(operators[i], text, options[i]);
        console.log(`[BOT]   option[${i}]="${options[i]}" op=${operators[i]} → ${matches}`);
        if (matches) {
          matchedIdx = i;
          break;
        }
      }
      
      // Default to first option (כניסה) if no match
      const finalIdx = matchedIdx !== -1 ? matchedIdx : 0;
      params['open'] = text.trim();
      session.parameters = params;
      session.markModified('parameters');
      const nextNodeId = findNextNode(currentNode.id, flowData.edges, `option-${finalIdx}`);
      console.log(`[BOT] 🎯 Matched option-${finalIdx} → nextNodeId=${nextNodeId}`);
      if (nextNodeId) {
        messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
        console.log(`[BOT] 📦 walkChain returned ${messages.length} messages:`, messages.map(m => `[${m.type}]${m.text ? ' "'+m.text.substring(0,40)+'"' : ''}`)  );
      }
    } else if (session.waiting_webservice && currentNode.type === 'action_web_service') {
      // User is responding to a webservice InputText request
      
      // Save user input
      session.last_user_input = text;
      
      // Re-call the webservice with the user input
      messages = await walkChain(currentNode.id, flowData.nodes, flowData.edges, session, session.flow_id, req);
    } else if (currentNode.type === 'input_text' || currentNode.type === 'input_date' || currentNode.type === 'input_file') {
      // Validate input type if configured on input_text nodes
      const validationType = currentNode.data.validationType;
      if (currentNode.type === 'input_text' && validationType && !validateInput(validationType, text)) {
        // Invalid input — notify user and re-prompt without advancing
        messages.push({ type: 'Text', text: 'הערך שהוזן אינו חוקי, אנא הזן ערך מתאים.', created: new Date().toISOString() });
        if (currentNode.data.label) {
          messages.push({ type: 'Text', text: replaceParameters(currentNode.data.label, params), created: new Date().toISOString() });
        }
        session.waiting_text_input = true;
        // current_node_id stays unchanged — fall through to session.save()
      } else {
      // We received the answer — no longer waiting
      session.waiting_text_input = false;

      // Save input to parameters
      const varName = currentNode.data.variableName;
      if (varName) {
        params[varName] = text;
      }
      params['open'] = text;
      session.parameters = params;
      session.markModified('parameters');

      // Save to contact custom_field_values if flagged
      if (varName && currentNode.data.saveToContact) {
        Contact.findOneAndUpdate(
          { user_id: session.user_id, phone: session.customer_phone },
          { $set: { [`custom_field_values.${varName}`]: text } },
          { upsert: true, new: true }
        ).catch(err => console.error('[BOT] Failed to save contact field:', err));
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
      }
    } else if (currentNode.type === 'output_menu') {
      // Handle menu selection
      const selectedValue = text.trim();
      const options = currentNode.data.options || [];
      const selectedIdx = options.findIndex(opt => opt.trim() === selectedValue);
      
      if (selectedIdx !== -1) {
        // Save selection to parameters
        if (currentNode.data.variableName) {
          params[currentNode.data.variableName] = selectedValue;
        }
        params['open'] = selectedValue;
        session.parameters = params;
        session.markModified('parameters');
        
        const nextNodeId = findNextNode(currentNode.id, flowData.edges, `option-${selectedIdx}`);
        if (nextNodeId) {
          messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
        }
      } else {
        // No matching option — try the default handle
        const defaultNextId = findNextNode(currentNode.id, flowData.edges, 'option-default');
        if (defaultNextId) {
          console.log(`[BOT] 🔀 output_menu: no match for "${selectedValue}", routing to option-default`);
          params['open'] = selectedValue;
          session.parameters = params;
          session.markModified('parameters');
          messages = await walkChain(defaultNextId, flowData.nodes, flowData.edges, session, session.flow_id, req);
        } else {
          messages.push({ 
            type: 'Text', 
            text: '⚠️ לא נמצאה אפשרות תואמת לתשובה שלך.',
            created: new Date().toISOString()
          });
        }
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
      
      params['open'] = text.trim();
      session.parameters = params;
      session.markModified('parameters');
      const finalIdx = matchedIdx !== -1 ? matchedIdx : 0;
      const nextNodeId = findNextNode(currentNode.id, flowData.edges, `option-${finalIdx}`);
      if (nextNodeId) {
        messages = await walkChain(nextNodeId, flowData.nodes, flowData.edges, session, session.flow_id, req);
      }
    }

    // Save session
    console.log(`[BOT] 💾 Saving session - sender: ${session.sender}, phone: ${session.customer_phone}`);
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
    console.log(`[BOT] 📤 RESPONSE - sender: ${sender}, session.sender: ${session.sender}, session.customer_phone: ${session.customer_phone}`);
    console.log(`[BOT] 📋 Messages summary:`, messages.map(m => `[${m.type}]${m.text ? ' "'+m.text.substring(0,60)+'"' : ''}`));
    console.log(`[BOT] 🌐 WHATSAPP_ENDPOINT=${process.env.WHATSAPP_ENDPOINT || '(not set)'}`);

    // Proactively push messages to WhatsApp via dialog360 /send endpoint.
    // When WHATSAPP_ENDPOINT is set and messages exist, push them directly and
    // return an empty messages array so dialog360 does NOT double-send.
    const waPushed = await pushMessagesToWhatsApp(sender, messages);
    console.log(`[BOT] 🚀 pushMessagesToWhatsApp → waPushed=${waPushed}`);

    return res.json({
      StatusId: 1,
      StatusDescription: 'Success',
      sender,
      messages: waPushed ? [] : messages,
      control,
      ...(waPushed && { wa_pushed: true }),
    });

  } catch (error) {
    console.error('[BOT] Error:', error);
    return res.status(500).json({
      StatusId: 0,
      StatusDescription: error.message
    });
  }
};
