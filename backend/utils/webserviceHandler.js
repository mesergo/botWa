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

  // Read node-level API settings (set via the settings modal)
  const httpMethod = ((node.data.apiMethod) || 'POST').toUpperCase();
  const customHeadersList = node.data.apiHeaders || [];
  const rawApiBody = node.data.apiBody || '';

  console.log('[WS] ▶▶▶ Final URL:', url);
  console.log('[WS] ▶▶▶ Session params:', JSON.stringify(session.parameters || {}));

  // Retry mechanism with exponential backoff
  let lastError = null;
  const maxRetries = 3;
  const timeoutMs = 15000; // 15 seconds timeout
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[WS] Attempt ${attempt}/${maxRetries}`);
      
      // Build standard bot payload
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
        value: userInput || null,
        process_history: session.process_history || []
      };

      // Determine actual request body: custom JSON (with --var-- interpolation) or standard payload
      const requestBodyStr = rawApiBody
        ? replaceParameters(rawApiBody, params)
        : JSON.stringify(payload);

      // Build headers: start with defaults, then merge custom headers from node settings
      const requestHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'ChatBot/1.0',
        'Accept': 'application/json'
      };
      for (const h of customHeadersList) {
        if (h.key && h.key.trim()) requestHeaders[h.key.trim()] = h.value || '';
      }

      // ── Detailed request logging ──────────────────────────────────────────
      console.log(`\n${'─'.repeat(60)}`);
      console.log(`[WS] 📤 REQUEST (attempt ${attempt}/${maxRetries})`);
      console.log(`[WS]    URL      : ${url}`);
      console.log(`[WS]    Method   : ${httpMethod}`);
      console.log(`[WS]    Headers  :`, JSON.stringify(requestHeaders));
      console.log(`[WS]    Body (${requestBodyStr.length} bytes): ${requestBodyStr.substring(0, 2000)}${requestBodyStr.length > 2000 ? '...(truncated)' : ''}`);
      console.log(`${'─'.repeat(60)}`);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      try {
        // Build fetch options; only add body for methods that support it
        const fetchOptions = {
          method: httpMethod,
          headers: requestHeaders,
          signal: controller.signal,
        };
        if (!['GET', 'HEAD'].includes(httpMethod)) {
          fetchOptions.body = requestBodyStr;
        }

        // Make HTTP request with timeout
        const response = await fetch(url, fetchOptions);

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'No error details');
          throw new Error(`API returned status ${response.status}: ${errorText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text();
          console.error('[WS] Non-JSON response:', text.substring(0, 500));
          throw new Error('Response is not JSON format');
        }

        const data = await response.json();
        const responseStr = JSON.stringify(data);
        console.log(`\n${'─'.repeat(60)}`);
        console.log(`[WS] ◀◀◀ RESPONSE (attempt ${attempt}/${maxRetries})`);
        console.log(`[WS]    HTTP Status  : ${response.status} ${response.statusText}`);
        console.log(`[WS]    Content-Type : ${response.headers.get('content-type') || '(none)'}`);
        console.log(`[WS]    Body (${responseStr.length} bytes):`);
        console.log(`[WS]    ${responseStr.substring(0, 2000)}${responseStr.length > 2000 ? '\n[WS]    ...(truncated)' : ''}`);
        console.log(`${'─'.repeat(60)}`);
        
        // Validate response structure
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid response structure');
        }

        const actions = data.actions || [];
        let returnValue = null;
        let waitingInput = false;
        let gotoLabel = null;

        // Process each action
        for (const action of actions) {
          const actionType = action.type;

          switch (actionType) {
            case 'SetParameter':
              params[action.name] = action.value;
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
              console.log('[WS] ⚠️ Waiting for user input');
              waitingInput = true;
              
              // If there are buttons/options, send them as menu with text
              if (action.options && Array.isArray(action.options) && action.options.length > 0) {
                console.log('[WS] 🔵 InputText has options:', action.options);
                // Convert to simple string array
                const optionsList = action.options.map(opt => {
                  if (typeof opt === 'string') return opt;
                  return opt.label || opt.text || opt.value || String(opt);
                });
                
                // Only send text message if there's actual text
                if (action.text && action.text.trim()) {
                  console.log('[WS] 🔵 Sending Text message:', action.text);
                  messages.push({
                    type: 'Text',
                    text: action.text,
                    created: new Date().toISOString()
                  });
                }
                
                console.log('[WS] 🔵 Sending Options message:', optionsList);
                messages.push({
                  type: 'Options',
                  options: optionsList, 
                  created: new Date().toISOString()
                });
              } else if (action.text) {
                // No options - just text input
                console.log('[WS] 🔵 InputText without options, text:', action.text);
                messages.push({
                  type: 'Text',
                  text: action.text,
                  created: new Date().toISOString()
                });
              }
              
              // IMMEDIATE BREAK FROM LOOP - Don't process Return or other actions after InputText
              console.log('[WS] 🛑 BREAK: Stopping action loop immediately - waiting for user input');
              break;
 
            case 'Return':
              returnValue = action.value;
              console.log('[WS] Return value:', returnValue);
              break;

            case 'Goto':
              gotoLabel = action.name || action.value;
              console.log('[WS] Goto target label:', gotoLabel);
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
          
          // CRITICAL: Stop processing remaining actions if waiting for input
          // This check must come AFTER the switch to catch InputText
          if (waitingInput) {
            console.log('[WS] 🛑 EXITING action loop - waitingInput = true, skipping remaining actions');
            break;
          }
        }

        // Update session parameters
        session.parameters = params;
        
        // Update waiting status
        session.waiting_text_input = waitingInput;
        session.waiting_webservice = waitingInput;

        console.log(`\n${'─'.repeat(60)}`);
        console.log(`[WS] ✅ SUCCESS — result to caller`);
        console.log(`[WS]    Messages count : ${messages.length}`);
        console.log(`[WS]    Message types  : [${messages.map(m => m.type).join(', ')}]`);
        console.log(`[WS]    ReturnValue    : ${JSON.stringify(returnValue)}`);
        console.log(`[WS]    WaitingInput   : ${waitingInput}`);
        console.log(`[WS]    GotoLabel      : ${gotoLabel || '(none)'}`);
        messages.forEach((msg, i) => {
          const preview = msg.text ? ` text="${msg.text.substring(0, 80)}"` : '';
          const opts = msg.options ? ` options=[${(msg.options || []).slice(0, 5).join(', ')}]` : '';
          console.log(`[WS]    msg[${i}]: type=${msg.type}${preview}${opts}`);
        });
        console.log(`${'─'.repeat(60)}`);

        // Success! Return the result
        return {
          messages,
          returnValue,
          waitingInput,
          gotoLabel
        };

      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }

    } catch (error) {
      lastError = error;
      const errorMsg = error.name === 'AbortError' ? 'Connection timeout' : error.message;
      console.error(`[WS] Attempt ${attempt} failed:`, errorMsg);
      
      // If this is the last attempt or a non-retryable error, break
      if (attempt === maxRetries || 
          error.message.includes('Invalid response structure') ||
          error.message.includes('not JSON format')) {
        break;
      }
      
      // Wait before retry with exponential backoff
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      console.log(`[WS] Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  // All retries failed - return error with detailed message
  const errorDetails = lastError?.name === 'AbortError' 
    ? 'השרת לא מגיב (timeout)'
    : lastError?.message || 'שגיאה לא ידועה';
  
  console.error('[WS] All retries failed. Last error:', errorDetails);
  
  // NOTE: we intentionally do NOT put the error text into `messages` here.
  // The caller (chatController.walkChain) decides whether to show it —
  // only when there's no 'default' exit connected to continue the flow silently.
  return {
    messages: [],
    returnValue: null,
    waitingInput: false,
    error: true,
    errorText: errorDetails
  };
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
  
  console.log(`[WS] 🔍 findMatchingOption: returnValue=${returnValue} | options=`, options);

  for (let i = 0; i < options.length; i++) {
    const matched = evaluateCondition(operators[i], returnValue, options[i]);
    console.log(`[WS]   option[${i}]="${options[i]}" op=${operators[i]} → ${matched}`);
    if (matched) {
      console.log(`[WS] ✅ Matched option ${i}: "${options[i]}"`);
      return i;
    }
  }
  
  console.log(`[WS] ⚠️ No option matched returnValue=${returnValue} → will use default`);
  return -1;
};
