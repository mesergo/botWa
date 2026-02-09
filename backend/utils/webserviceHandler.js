import BotSession from '../models/BotSession.js';
import fetch from 'node-fetch';

// Helper: Replace parameters in text
const replaceParameters = (text, parameters) => {
  if (!text) return '';
  return text.replace(/--(.+?)--/g, (match, paramName) => {
    const value = parameters[paramName];
    return value !== undefined ? String(value) : 'null';
  });
};

// Helper: Evaluate condition for Return values
const evaluateCondition = (operator, value, target) => {
  if (value === null || value === undefined) return false;
  
  const v = isNaN(Number(value)) ? String(value).toLowerCase() : Number(value);
  const t = isNaN(Number(target)) ? String(target).toLowerCase() : Number(target);
  
  switch(operator) {
    case 'gt': return typeof v === 'number' && typeof t === 'number' ? v > t : false;
    case 'gte': return typeof v === 'number' && typeof t === 'number' ? v >= t : false;
    case 'lt': return typeof v === 'number' && typeof t === 'number' ? v < t : false;
    case 'lte': return typeof v === 'number' && typeof t === 'number' ? v <= t : false;
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

/**
 * Process webservice actions and return messages
 * @param {Object} node - The webservice node
 * @param {Object} session - Chat session
 * @param {String} userInput - Optional user input if waiting for input
 * @returns {Object} { messages: [], returnValue: any, waitingInput: boolean }
 */
export const handleWebService = async (node, session, userInput = null) => {
  const messages = [];
  const params = session.parameters || {};
  
  console.log('[WS] Starting webservice handler for node:', node.id);

  // Build URL
  let url = node.data.url || '';
  
  // If waiting for input, replace query parameter
  if (session.waiting_text_input && userInput) {
    url = url.replace('query=--query--&', '');
    const separator = url.includes('?') ? '&' : '?';
    url += separator + 'value=' + encodeURIComponent(userInput);
    console.log('[WS] Added user input to URL');
  }

  // Replace parameters
  url = replaceParameters(url, params);
  
  // Remove null values from URL
  url = url.replace(/=[^&]*null[^&]*/g, '').replace(/[?&]&/g, '?').replace(/[?&]$/, '');

  console.log('[WS] Final URL:', url);

  try {
    // Build payload similar to PHP version
    const payload = {
      campaign: {
        id: 50000,
        name: "FlowBot Campaign"
      },
      chat: {
        created: new Date().toISOString().replace('T', ' ').split('.')[0],
        source: "FlowBot_Node",
        sender: session.sender,
        control: node.id
      },
      parameters: Object.entries(params).map(([name, value]) => ({ name, value })),
      value: userInput ? {
        string: userInput,
        number: isNaN(Number(userInput)) ? null : Number(userInput)
      } : null,
      process_history: session.process_history || []
    };

    // Make HTTP request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ChatBot/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();
    console.log('[WS] Received response:', JSON.stringify(data).substring(0, 200));

    const actions = data.actions || [];
    let returnValue = null;
    let waitingInput = false;

    // Process each action
    for (const action of actions) {
      const actionType = action.type;
      console.log('[WS] Processing action:', actionType);

      switch (actionType) {
        case 'SetParameter':
          params[action.name] = action.value;
          console.log(`[WS] Set parameter ${action.name} = ${action.value}`);
          break;

        case 'SendMessage':
          messages.push({
            type: 'Text',
            text: action.text,
            created: new Date().toISOString()
          });
          break;

        case 'SendWebpage':
          messages.push({
            type: 'URL',
            text: action.text || 'קישור',
            url: action.url || action.text,
            created: new Date().toISOString()
          });
          break;

        case 'SendImage':
          messages.push({
            type: 'Image',
            url: action.value || action.url,
            created: new Date().toISOString()
          });
          break;

        case 'SendItem':
          messages.push({
            type: 'SendItem',
            title: action.title || '',
            subtitle: action.subtitle || '',
            image: action.image || null,
            url: action.url || null,
            options: action.options || [],
            created: new Date().toISOString()
          });
          break;

        case 'InputText':
          console.log('[WS] Waiting for user input');
          waitingInput = true;
          
          // If there are buttons/options, send them
          if (action.options && Array.isArray(action.options) && action.options.length > 0) {
            messages.push({
              type: 'Options',
              text: action.text || '',
              options: action.options.map(opt => ({
                label: typeof opt === 'string' ? opt : opt.label || opt.text,
                value: typeof opt === 'string' ? opt : opt.value || opt.text
              })),
              created: new Date().toISOString()
            });
          } else if (action.text) {
            messages.push({
              type: 'Text',
              text: action.text,
              created: new Date().toISOString()
            });
          }
          break;

        case 'Return':
          returnValue = action.value;
          console.log('[WS] Return value:', returnValue);
          break;

        case 'ChangeState':
          messages.push({
            type: 'Text',
            text: `[מצב בוט שונה ל: ${action.value}]`,
            created: new Date().toISOString()
          });
          break;

        default:
          console.log(`[WS] Unknown action type: ${actionType}`);
      }
    }

    // Update session parameters
    session.parameters = params;
    
    // Update waiting status
    session.waiting_text_input = waitingInput;
    session.waiting_webservice = waitingInput;

    return {
      messages,
      returnValue,
      waitingInput
    };

  } catch (error) {
    console.error('[WS] Error:', error.message);
    return {
      messages: [{
        type: 'Text',
        text: '❌ שגיאה בחיבור לשרת ה-Webservice',
        created: new Date().toISOString()
      }],
      returnValue: null,
      waitingInput: false
    };
  }
};

/**
 * Find matching option based on return value
 * @param {Object} node - The webservice node
 * @param {*} returnValue - Value returned from webservice
 * @returns {Number} Index of matching option or -1
 */
export const findMatchingOption = (node, returnValue) => {
  if (returnValue === null || returnValue === undefined) return -1;
  
  const options = node.data.options || [];
  const operators = node.data.optionOperators || options.map(() => 'eq');
  
  for (let i = 0; i < options.length; i++) {
    if (evaluateCondition(operators[i], returnValue, options[i])) {
      console.log(`[WS] Matched option ${i}: ${options[i]}`);
      return i;
    }
  }
  
  return -1;
};
