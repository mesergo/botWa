import Template from '../models/Template.js';
import Widget from '../models/Widget.js';
import Option from '../models/Option.js';
import BotFlow from '../models/BotFlow.js';
import Version from '../models/Version.js';
import User from '../models/User.js';
import { ObjectId } from 'mongodb';

/**
 * Highly detailed templates data to seed the DB
 */
const INITIAL_TEMPLATES = [
  {
    template_id: 'about_us',
    name: 'אודותינו',
    nodes: [
      { id: 'start_node', type: 'automatic_responses', position: { x: 100, y: 300 }, data: { label: 'תגובות אוטומטיות', options: ['כניסה', 'שלום', 'מי אתם'], optionOperators: ['eq', 'contains', 'contains'], serialId: '#1' } },
      { id: 'welcome_msg', type: 'output_text', position: { x: 500, y: 300 }, data: { content: 'ברוכים הבאים ל-{{comp_name}}! 🌟\nאנחנו שמחים שאתם כאן. רוצים להכיר אותנו קצת יותר?', serialId: '#2' } },
      { id: 'vision_msg', type: 'output_text', position: { x: 900, y: 300 }, data: { content: 'החזון שלנו ב-{{comp_name}} הוא להוביל בתחום ולתת את השירות המקצועי ביותר תוך שמירה על ערכי חדשנות ואמינות.', serialId: '#3' } },
      { id: 'main_menu', type: 'output_menu', position: { x: 1300, y: 300 }, data: { content: 'במה תרצו להתמקד?', options: ['הסיפור שלנו', 'הצוות המנצח', 'איך יוצרים קשר?', 'מיקום וכתובת', 'לאתר הרשמי'], serialId: '#4' } },
      { id: 'story_msg', type: 'output_text', position: { x: 1750, y: 50 }, data: { content: 'הכל התחיל לפני שנים, כשזיהינו צורך בפתרון אמיתי עבור לקוחותינו... (כאן כדאי להוסיף את סיפור הקמת החברה שלכם)', serialId: '#5' } },
      { id: 'team_msg', type: 'output_text', position: { x: 1750, y: 200 }, data: { content: 'הצוות שלנו מורכב מהמומחים הגדולים ביותר בתחום, כולם מחויבים להצלחה שלכם.', serialId: '#6' } },
      { id: 'contact_msg', type: 'output_text', position: { x: 1750, y: 350 }, data: { content: 'זמינים עבורכם בטלפון: {{comp_phone}}\nבכל שאלה או בקשה!', serialId: '#7' } },
      { id: 'address_msg', type: 'output_text', position: { x: 1750, y: 500 }, data: { content: 'המשרדים המעוצבים שלנו מחכים לכם בכתובת: {{comp_address}}', serialId: '#8' } },
      { id: 'website_link', type: 'output_link', position: { x: 1750, y: 650 }, data: { linkLabel: 'מעבר לאתר החברה', url: '{{comp_website}}', serialId: '#9' } },
      { id: 'image_logo', type: 'output_image', position: { x: 900, y: 500 }, data: { url: '{{comp_logo}}', serialId: '#10' } }
    ],
    edges: [
      { source: 'start_node', sourceHandle: 'option-0', target: 'welcome_msg' },
      { source: 'welcome_msg', target: 'vision_msg' },
      { source: 'vision_msg', target: 'main_menu' },
      { source: 'main_menu', sourceHandle: 'option-0', target: 'story_msg' },
      { source: 'main_menu', sourceHandle: 'option-1', target: 'team_msg' },
      { source: 'main_menu', sourceHandle: 'option-2', target: 'contact_msg' },
      { source: 'main_menu', sourceHandle: 'option-3', target: 'address_msg' },
      { source: 'main_menu', sourceHandle: 'option-4', target: 'website_link' }
    ]
  },
  {
    template_id: 'customer_service',
    name: 'שירות לקוחות',
    nodes: [
      { id: 'start', type: 'automatic_responses', position: { x: 100, y: 300 }, data: { label: 'תגובות אוטומטיות', options: ['כניסה', 'נציג', 'עזרה'], optionOperators: ['eq', 'contains', 'contains'], serialId: '#1' } },
      { id: 'welcome', type: 'output_text', position: { x: 500, y: 300 }, data: { content: 'שלום! הגעתם למוקד השירות של {{comp_name}}. 🎧\nאיך נוכל לסייע לכם היום?', serialId: '#2' } },
      { id: 'main_menu', type: 'output_menu', position: { x: 900, y: 300 }, data: { content: 'אנא בחרו את נושא הפנייה:', options: ['שאלות נפוצות (FAQ)', 'פתיחת קריאת שירות', 'בירור חשבון/תשלום', 'דיבור עם נציג אנושי'], serialId: '#3' } },
      { id: 'faq_menu', type: 'output_menu', position: { x: 1350, y: 50 }, data: { content: 'נושא ה-FAQ:', options: ['מדיניות משלוחים', 'ביטול עסקה', 'תמיכה טכנית'], serialId: '#4' } },
      { id: 'shipping_faq', type: 'output_text', position: { x: 1800, y: -50 }, data: { content: 'המשלוחים שלנו יוצאים תוך 24 שעות ומגיעים לכל חלקי הארץ. 🚚', serialId: '#5' } },
      { id: 'cancel_faq', type: 'output_text', position: { x: 1800, y: 100 }, data: { content: 'ניתן לבטל עסקה עד 14 ימים מיום הרכישה בהתאם לחוק הגנת הצרכן.', serialId: '#6' } },
      { id: 'tech_faq', type: 'output_text', position: { x: 1800, y: 250 }, data: { content: 'נתקלתם בבעיה? נסו להפעיל מחדש את המערכת. אם לא עוזר, פתחו קריאה.', serialId: '#7' } },
      { id: 'ticket_input', type: 'input_text', position: { x: 1350, y: 300 }, data: { label: 'אנא תארו בפירוט את מהות הפנייה:', variableName: 'issue_details', serialId: '#8' } },
      { id: 'ticket_confirm', type: 'output_text', position: { x: 1800, y: 400 }, data: { content: 'תודה. הפנייה שלכם בטיפול. מספר הקריאה: #{{issue_details_hash}}', serialId: '#9' } },
      { id: 'account_msg', type: 'output_text', position: { x: 1350, y: 500 }, data: { content: 'לבירור מצב חשבון אנא הכינו את מספר הלקוח שלכם.', serialId: '#10' } },
      { id: 'human_wait', type: 'action_wait', position: { x: 1350, y: 650 }, data: { waitTime: 3, serialId: '#11' } },
      { id: 'human_msg', type: 'output_text', position: { x: 1800, y: 650 }, data: { content: 'מעביר אתכם לנציג... אנא המתינו רגע.', serialId: '#12' } }
    ],
    edges: [
      { source: 'start', sourceHandle: 'option-0', target: 'welcome' },
      { source: 'welcome', target: 'main_menu' },
      { source: 'main_menu', sourceHandle: 'option-0', target: 'faq_menu' },
      { source: 'main_menu', sourceHandle: 'option-1', target: 'ticket_input' },
      { source: 'main_menu', sourceHandle: 'option-2', target: 'account_msg' },
      { source: 'main_menu', sourceHandle: 'option-3', target: 'human_wait' },
      { source: 'faq_menu', sourceHandle: 'option-0', target: 'shipping_faq' },
      { source: 'faq_menu', sourceHandle: 'option-1', target: 'cancel_faq' },
      { source: 'faq_menu', sourceHandle: 'option-2', target: 'tech_faq' },
      { source: 'ticket_input', target: 'ticket_confirm' },
      { source: 'human_wait', target: 'human_msg' }
    ]
  },
  {
    template_id: 'appointments',
    name: 'תיאום פגישה',
    nodes: [
      { id: 'start', type: 'automatic_responses', position: { x: 100, y: 300 }, data: { label: 'תגובות אוטומטיות', options: ['כניסה', 'תור', 'פגישה'], optionOperators: ['eq', 'contains', 'contains'], serialId: '#1' } },
      { id: 'welcome', type: 'output_text', position: { x: 500, y: 300 }, data: { content: 'שלום! כאן תוכלו לתאם פגישה עם צוות {{comp_name}} בקלות. 🗓️', serialId: '#2' } },
      { id: 'type_menu', type: 'output_menu', position: { x: 900, y: 300 }, data: { content: 'איזה סוג פגישה תרצו לתאם?', options: ['ייעוץ ראשוני', 'ליווי טכני', 'פגישת עבודה'], serialId: '#3' } },
      { id: 'date_input', type: 'input_date', position: { x: 1300, y: 300 }, data: { label: 'בחרו תאריך שמתאים לכם:', serialId: '#4' } },
      { id: 'time_input', type: 'input_text', position: { x: 1700, y: 300 }, data: { label: 'באיזו שעה בערך נח לכם?', variableName: 'pref_time', serialId: '#5' } },
      { id: 'prep_msg', type: 'output_text', position: { x: 2100, y: 300 }, data: { content: 'חשוב לדעת: הפגישה תיערך בכתובת: {{location}}.\nנא להצטייד במזהה לקוח.', serialId: '#6' } },
      { id: 'confirm', type: 'output_text', position: { x: 2500, y: 300 }, data: { content: 'התור שלכם נקבע! נשלח לכם תזכורת ב-SMS. נתראה בקרוב! 👋', serialId: '#7' } }
    ],
    edges: [
      { source: 'start', sourceHandle: 'option-0', target: 'welcome' },
      { source: 'welcome', target: 'type_menu' },
      { source: 'type_menu', target: 'date_input' },
      { source: 'date_input', target: 'time_input' },
      { source: 'time_input', target: 'prep_msg' },
      { source: 'prep_msg', target: 'confirm' }
    ]
  },
  {
    template_id: 'product_order',
    name: 'הזמנת מוצרים',
    nodes: [
      { id: 'start', type: 'automatic_responses', position: { x: 100, y: 300 }, data: { label: 'תגובות אוטומטיות', options: ['כניסה', 'הזמנה', 'לקנות'], optionOperators: ['eq', 'contains', 'contains'], serialId: '#1' } },
      { id: 'welcome', type: 'output_text', position: { x: 500, y: 300 }, data: { content: 'ברוכים הבאים לחנות של {{comp_name}}! 🛍️\nאיך אפשר לעזור לכם להתחדש?', serialId: '#2' } },
      { id: 'main_menu', type: 'output_menu', position: { x: 900, y: 300 }, data: { content: 'במה תרצו לצפות?', options: ['קטלוג מוצרים', 'מבצעים חמים', 'מדיניות משלוחים', 'נציג מכירות'], serialId: '#3' } },
      { id: 'cat_img', type: 'output_image', position: { x: 1350, y: 50 }, data: { url: '', serialId: '#4' } },
      { id: 'cat_link', type: 'output_link', position: { x: 1750, y: 50 }, data: { linkLabel: 'לקטלוג המלא לחצו כאן', url: '{{catalog_link}}', serialId: '#5' } },
      { id: 'promo_msg', type: 'output_text', position: { x: 1350, y: 250 }, data: { content: 'יש לנו מבצע של 20% הנחה על כל האתר לשבוע הקרוב! 🎁', serialId: '#6' } },
      { id: 'shipping_msg', type: 'output_text', position: { x: 1350, y: 450 }, data: { content: 'משלוח חינם בקניה מעל 299₪. עלות רגילה: {{delivery_price}}.', serialId: '#7' } },
      { id: 'sales_wait', type: 'action_wait', position: { x: 1350, y: 650 }, data: { waitTime: 2, serialId: '#8' } },
      { id: 'sales_msg', type: 'output_text', position: { x: 1750, y: 650 }, data: { content: 'נציג מכירות מיד איתכם לסגירת הזמנה טלפונית.', serialId: '#9' } }
    ],
    edges: [
      { source: 'start', sourceHandle: 'option-0', target: 'welcome' },
      { source: 'welcome', target: 'main_menu' },
      { source: 'main_menu', sourceHandle: 'option-0', target: 'cat_img' },
      { source: 'cat_img', target: 'cat_link' },
      { source: 'main_menu', sourceHandle: 'option-1', target: 'promo_msg' },
      { source: 'main_menu', sourceHandle: 'option-2', target: 'shipping_msg' },
      { source: 'main_menu', sourceHandle: 'option-3', target: 'sales_wait' },
      { source: 'sales_wait', target: 'sales_msg' }
    ]
  },
  {
    template_id: 'order_status',
    name: 'בירור מצב הזמנה',
    nodes: [
      { id: 'start', type: 'automatic_responses', position: { x: 100, y: 300 }, data: { label: 'תגובות אוטומטיות', options: ['כניסה', 'איפה החבילה', 'סטטוס'], optionOperators: ['eq', 'contains', 'contains'], serialId: '#1' } },
      { id: 'welcome', type: 'output_text', position: { x: 500, y: 300 }, data: { content: 'שלום! בואו נבדוק מה המצב של ההזמנה שלכם. 📦', serialId: '#2' } },
      { id: 'order_id_input', type: 'input_text', position: { x: 900, y: 300 }, data: { label: 'אנא הזינו את מספר ההזמנה (למשל 12345):', variableName: 'order_id', serialId: '#3' } },
      { id: 'api_call', type: 'action_web_service', position: { x: 1300, y: 300 }, data: { url: '{{api_url}}', options: ['נשלח', 'בטיפול', 'בוטל', 'תקלה'], optionOperators: ['contains', 'contains', 'contains', 'contains'], serialId: '#4' } },
      { id: 'shipped_msg', type: 'output_text', position: { x: 1750, y: 50 }, data: { content: 'חדשות מעולות! ההזמנה שלכם יצאה לדרך עם שליח. 🚚', serialId: '#5' } },
      { id: 'pending_msg', type: 'output_text', position: { x: 1750, y: 200 }, data: { content: 'ההזמנה בטיפול במחסן שלנו ותצא בקרוב.', serialId: '#6' } },
      { id: 'cancel_msg', type: 'output_text', position: { x: 1750, y: 350 }, data: { content: 'מצטערים, ההזמנה בוטלה. פנו לשירות לקוחות לבירור.', serialId: '#7' } },
      { id: 'issue_menu', type: 'output_menu', position: { x: 1750, y: 550 }, data: { content: 'נראה שיש בעיה. מה תרצו לדווח?', options: ['פריט חסר', 'פריט פגום', 'איחור במשלוח'], serialId: '#8' } },
      { id: 'issue_report', type: 'output_text', position: { x: 2200, y: 550 }, data: { content: 'הדיווח התקבל. נציג יבדוק את הנושא מול חברת ההפצה ויחזור אליכם.', serialId: '#9' } }
    ],
    edges: [
      { source: 'start', sourceHandle: 'option-0', target: 'welcome' },
      { source: 'welcome', target: 'order_id_input' },
      { source: 'order_id_input', target: 'api_call' },
      { source: 'api_call', sourceHandle: 'option-0', target: 'shipped_msg' },
      { source: 'api_call', sourceHandle: 'option-1', target: 'pending_msg' },
      { source: 'api_call', sourceHandle: 'option-2', target: 'cancel_msg' },
      { source: 'api_call', sourceHandle: 'option-3', target: 'issue_menu' },
      { source: 'issue_menu', target: 'issue_report' }
    ]
  }
];

/**
 * Seeding: Insert templates only if they don't already exist.
 * Existing templates (even if modified by users) are never overwritten.
 */
export const seedTemplates = async () => {
  console.log('Synchronizing predefined templates in DB...');
  for (const template of INITIAL_TEMPLATES) {
    await Template.updateOne(
      { template_id: template.template_id },
      { $setOnInsert: { ...template, type: 'public', isPublic: true } },
      { upsert: true }
    );
  }
  console.log('Templates synchronized successfully.');
};

export const initializeFromTemplate = async (req, res) => {
  const userId = req.user.id;
  const { bot_id, template_id, values } = req.body;

  try {
    // Support lookup by MongoDB _id (ObjectId) or by template_id string
    let template = null;
    try {
      template = await Template.findById(template_id);
    } catch (_) {}
    if (!template) {
      template = await Template.findOne({ template_id });
    }
    if (!template) {
      return res.status(404).json({ error: 'Template not found in DB' });
    }

    const idMap = {};
    template.nodes.forEach(node => {
      idMap[node.id] = new ObjectId().toString();
    });

    const processedNodes = template.nodes.map(node => {
      const newNode = JSON.parse(JSON.stringify(node)); 
      newNode.id = idMap[node.id]; 
      
      if (newNode.data) {
        if (newNode.data.content) newNode.data.content = replaceAll(newNode.data.content, values);
        if (newNode.data.label) newNode.data.label = replaceAll(newNode.data.label, values);
        if (newNode.data.url) newNode.data.url = replaceAll(newNode.data.url, values);
        if (newNode.data.linkLabel) newNode.data.linkLabel = replaceAll(newNode.data.linkLabel, values);
      }
      return newNode;
    });

    const processedEdges = template.edges.map(edge => ({
      ...edge,
      source: idMap[edge.source],
      target: idMap[edge.target]
    }));

    await Widget.deleteMany({ user_id: userId, flow_id: bot_id });

    for (const node of processedNodes) {
      const isFirst = (node.type === 'start' || node.type === 'automatic_responses') ? 1 : 0;
      const isTimeRouting = node.type === 'action_time_routing';
      const isBranching = node.type === 'output_menu' || node.type === 'action_web_service' || node.type === 'automatic_responses' || isTimeRouting;
      
      const nextEdge = !isBranching ? processedEdges.find(e => e.source === node.id && !e.sourceHandle) : null;
      const nextId = nextEdge ? nextEdge.target : null;

      const metadataObj = { ...node.data };
      delete metadataObj.options;
      delete metadataObj.optionOperators;
      delete metadataObj.optionImages;

      await Widget.create({
        id: node.id,
        user_id: userId,
        flow_id: bot_id,
        is_first: isFirst,
        type: node.type,
        value: node.data.label || node.data.content || '',
        pos_x: node.position.x,
        pos_y: node.position.y,
        next: nextId,
        image_file: metadataObj,
        standard_process_id: null,
        isStandardProcess: 0
      });

      await Option.deleteMany({ widget_id: node.id });

      if (isTimeRouting) {
        const timeRanges = node.data.timeRanges || [];
        for (let i = 0; i < timeRanges.length; i++) {
          const range = timeRanges[i];
          const optionEdge = processedEdges.find(e => e.source === node.id && e.sourceHandle === `option-${i}`);
          await Option.create({
            widget_id: node.id,
            value: `${range.fromHour}-${range.toHour}`,
            next: optionEdge ? optionEdge.target : null,
            image_url: null,
            operator: 'time_range'
          });
        }
        const defaultEdge = processedEdges.find(e => e.source === node.id && e.sourceHandle === 'option-default');
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
          const optionEdge = processedEdges.find(e => e.source === node.id && e.sourceHandle === `option-${i}`);
          
          await Option.create({
            widget_id: node.id,
            value: branchValue,
            next: optionEdge ? optionEdge.target : null,
            image_url: node.data.optionImages?.[i] || null,
            operator: branchOperator
          });
        }
      }
    }

    // Save the filled-in values as botParams on the BotFlow document so
    // the simulator can pre-populate --variableName-- placeholders at runtime.
    if (values && Object.keys(values).length > 0) {
      await BotFlow.findByIdAndUpdate(bot_id, { botParams: values });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Template Initialization Error:', err);
    res.status(500).json({ error: err.message });
  }
};

function replaceAll(text, values) {
  let result = text;
  Object.entries(values).forEach(([key, val]) => {
    const safeKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`{{${safeKey}}}`, 'g'), val || '');
  });
  return result;
}

// --- Template Management ---

export const getAllTemplates = async (req, res) => {
  try {
    const templates = await Template.find({});
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getPublicTemplates = async (req, res) => {
  try {
    // Base: show public and public_paid to everyone
    const query = { type: { $in: ['public', 'public_paid'] } };
    // If request comes from an impersonating admin session, also include admin templates
    if (req.user && req.user.isImpersonating) {
      query.type.$in.push('admin');
    }
    const templates = await Template.find(query);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllSystemBots = async (req, res) => {
  try {
    const bots = await BotFlow.find({}).sort({ created_at: -1 });
    const userIds = [...new Set(bots.map(b => b.user_id).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }, 'name email');
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u.name || u.email || u._id.toString(); });
    res.json(bots.map(b => ({
      id: b._id.toString(),
      name: b.name,
      user_id: b.user_id ? b.user_id.toString() : null,
      user_name: b.user_id ? (userMap[b.user_id.toString()] || 'לא ידוע') : 'לא ידוע',
      public_id: b.public_id,
      created_at: b.created_at
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTemplate = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id); 
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTemplateFlow = async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({
      nodes: template.nodes || [],
      edges: template.edges || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTemplateFlow = async (req, res) => {
  const { nodes, edges } = req.body;
  try {
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      { nodes, edges },
      { new: true }
    );
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createTemplate = async (req, res) => {
  const { name, description, nodes, edges, template_id, isPublic, type, price } = req.body;
  try {
    const templateType = type || 'public';
    const newTemplate = new Template({
      template_id: template_id || `tpl_${Date.now()}`,
      name,
      description,
      isPublic: templateType === 'public' || templateType === 'public_paid',
      type: templateType,
      price: price || 0,
      nodes,
      edges
    });
    await newTemplate.save();
    res.json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateTemplate = async (req, res) => {
  const { name, description, nodes, edges, template_id, isPublic, type, price } = req.body;
  
  // Build update object dynamically
  const updateData = {};
  if (name) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (type !== undefined) {
    updateData.type = type;
    updateData.isPublic = type === 'public' || type === 'public_paid';
  } else if (isPublic !== undefined) {
    updateData.isPublic = isPublic;
  }
  if (price !== undefined) updateData.price = price;
  if (nodes) updateData.nodes = nodes;
  if (edges) updateData.edges = edges;
  if (template_id) updateData.template_id = template_id; // Allow updating ID if needed, but be careful

  try {
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    await Template.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createTemplateFromBot = async (req, res) => {
  const { botId, name, description } = req.body; 
  
  try {
    // Fetch the current live flow (widgets) for this bot
    // Use .lean() so w.id returns the custom schema field, not Mongoose's _id virtual
    const widgets = await Widget.find({ flow_id: botId, standard_process_id: null }).lean();

    let nodes = [];
    let edges = [];

    if (widgets.length > 0) {
      // Fetch options for all widgets
      const options = await Option.find({ widget_id: { $in: widgets.map(w => w.id) } }).lean();

      // Build nodes with full data including options
      nodes = widgets.map(w => {
        const nodeOptions = options.filter(o => o.widget_id === w.id);
        const metadata = w.image_file || {};

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
            position: { x: w.pos_x || 0, y: w.pos_y || 0 },
            data: { ...metadata, timeRanges }
          };
        }

        return {
          id: w.id,
          type: w.type,
          position: { x: w.pos_x || 0, y: w.pos_y || 0 },
          data: {
            ...metadata,
            label: metadata.label !== undefined ? metadata.label : (w.value || ''),
            content: metadata.content !== undefined ? metadata.content : (w.value || ''),
            options: nodeOptions.length > 0 ? nodeOptions.map(o => o.value) : undefined,
            optionOperators: nodeOptions.length > 0 ? nodeOptions.map(o => o.operator || 'eq') : undefined,
            optionImages: nodeOptions.length > 0 ? nodeOptions.map(o => o.image_url) : undefined
          }
        };
      });

      // Build edges from widget.next and options.next
      widgets.forEach(w => {
        if (w.next) {
          edges.push({ id: `e-${w.id}-${w.next}`, source: w.id, target: w.next, type: 'button' });
        }
        const wOptions = options.filter(o => o.widget_id === w.id);
        if (w.type === 'action_time_routing') {
          let timeRangeIndex = 0;
          wOptions.forEach(o => {
            if (o.next) {
              const sourceHandle = o.operator === 'default' ? 'option-default' : `option-${timeRangeIndex}`;
              edges.push({ id: `e-${w.id}-${sourceHandle}-${o.next}`, source: w.id, sourceHandle, target: o.next, type: 'button' });
              if (o.operator === 'time_range') timeRangeIndex++;
            } else if (o.operator === 'time_range') {
              timeRangeIndex++;
            }
          });
        } else {
          wOptions.forEach((o, i) => {
            if (o.next) {
              edges.push({ id: `e-${w.id}-opt-${i}`, source: w.id, sourceHandle: `option-${i}`, target: o.next, type: 'button' });
            }
          });
        }
      });
    } else {
      // Fallback to latest version data
      const latestVersion = await Version.findOne({ flow_id: botId }).sort({ created_at: -1 });
      if (latestVersion) {
        nodes = latestVersion.data.nodes || [];
        edges = latestVersion.data.edges || [];
      }
    }

    const botInfo = await BotFlow.findById(botId);
    const newTemplate = new Template({
      template_id: `tpl_${Date.now()}`,
      name: name || (botInfo ? `תבנית מ-${botInfo.name}` : 'תבנית חדשה'),
      description,
      isPublic: false,
      type: 'admin',
      nodes,
      edges
    });

    await newTemplate.save();
    res.json(newTemplate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Update (or replace) the params array of a template.
 * Body: { params: [{ label, variableName }] }
 */
export const updateTemplateParams = async (req, res) => {
  const { params } = req.body;
  if (!Array.isArray(params)) {
    return res.status(400).json({ error: 'params must be an array' });
  }
  try {
    const template = await Template.findByIdAndUpdate(
      req.params.id,
      { params },
      { new: true }
    );
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true, params: template.params });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const cloneBotFlow = async (req, res) => {
  const userId = req.user.id;
  const { sourceBotId, targetBotId } = req.body;

  try {
    // Verify both bots belong to this user
    const [sourceBot, targetBot] = await Promise.all([
      BotFlow.findOne({ _id: sourceBotId, user_id: userId }),
      BotFlow.findOne({ _id: targetBotId, user_id: userId })
    ]);

    if (!sourceBot || !targetBot) {
      return res.status(404).json({ error: 'Bot not found or access denied' });
    }

    // Get source flow data (nodes/edges stored in sync)
    // Use .lean() so that w.id returns the custom schema field, not Mongoose's _id virtual
    const sourceWidgets = await Widget.find({ flow_id: sourceBotId, user_id: userId }).lean();
    const sourceOptions = await Option.find({ widget_id: { $in: sourceWidgets.map(w => w.id) } }).lean();

    // Clear target bot
    const targetWidgetIds = (await Widget.find({ flow_id: targetBotId, user_id: userId }).lean()).map(w => w.id);
    await Option.deleteMany({ widget_id: { $in: targetWidgetIds } });
    await Widget.deleteMany({ flow_id: targetBotId, user_id: userId });

    // Create id map for cloning
    const idMap = {};
    sourceWidgets.forEach(w => {
      idMap[w.id] = new ObjectId().toString();
    });

    // Clone widgets
    for (const widget of sourceWidgets) {
      const newId = idMap[widget.id];
      await Widget.create({
        id: newId,
        user_id: userId,
        flow_id: targetBotId,
        is_first: widget.is_first,
        type: widget.type,
        value: widget.value,
        pos_x: widget.pos_x,
        pos_y: widget.pos_y,
        next: widget.next ? (idMap[widget.next] || widget.next) : null,
        image_file: widget.image_file,
        target_variable: widget.target_variable || null,
        input_variable: widget.input_variable || null,
        standard_process_id: null,
        isStandardProcess: 0
      });

      // Clone options
      const opts = sourceOptions.filter(o => o.widget_id === widget.id);
      for (const opt of opts) {
        await Option.create({
          widget_id: newId,
          value: opt.value,
          next: opt.next ? (idMap[opt.next] || opt.next) : null,
          image_url: opt.image_url,
          operator: opt.operator
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
