import mongoose from 'mongoose';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { SECRET_KEY } from '../middleware/auth.js';
import UserType from '../models/UserType.js';
import { resolvePermissions, hasPermission } from '../middleware/auth.js';

// Returns the root company manager ID for the given userId.
// If the user is a sub-user (rep/rep_manager with a manager_id), returns that manager_id.
// Otherwise returns the user's own _id (they are the company owner).
const getRootManagerId = async (userId) => {
  const user = await User.findById(userId).select('manager_id').lean();
  if (user && user.manager_id) return user.manager_id.toString();
  return userId.toString();
};

// GET /api/sub-users — list all reps belonging to the authenticated company manager
export const getSubUsers = async (req, res) => {
  try {
    const managerId = await getRootManagerId(req.userId);
    const actor = await User.findById(req.userId).select('role user_type_id').lean();
    const actorPerms = await resolvePermissions(actor || { role: req.user?.role });

    let availableUserTypes = [];
    if (hasPermission(actorPerms, 'users.add')) {
      // Admin-role types (system_role: 'admin') must never be creatable from the Sub-Users
      // tab, regardless of their show_in_users_tab flag — this endpoint only ever creates
      // rep / rep_manager / user accounts (see the allowedRoles check in createSubUser).
      const filter = { show_in_users_tab: true, system_role: { $ne: 'admin' } };
      if (actor?.role === 'admin') {
        // Admin by role always gets all (non-admin) user types
        availableUserTypes = await UserType.find(filter).select('_id name system_role').sort({ createdAt: 1 }).lean();
      } else {
        // Mirror resolvePermissions: prefer explicit user_type_id, fall back to seeded type by role
        const actorType = actor?.user_type_id
          ? await UserType.findById(actor.user_type_id).lean()
          : actor?.role
            ? await UserType.findOne({ system_role: actor.role, is_seeded: true }).lean()
            : null;
        const canAddByType = !!actorType?.can_add_users;
        const allowedIds = Array.isArray(actorType?.allowed_user_type_ids) ? actorType.allowed_user_type_ids : [];
        if (canAddByType) {
          if (allowedIds.length > 0) {
            availableUserTypes = await UserType.find({ _id: { $in: allowedIds }, show_in_users_tab: true, system_role: { $ne: 'admin' } })
              .select('_id name system_role')
              .sort({ createdAt: 1 })
              .lean();
          } else {
            availableUserTypes = await UserType.find(filter).select('_id name system_role').sort({ createdAt: 1 }).lean();
          }
        }
      }
    }

    const reps = await User.find({ manager_id: managerId }).select(
      'name email phone role status availability_status createdAt rep_group_ids allowed_bot_ids user_type_id'
    ).sort({ createdAt: -1 });
    res.json({
      users: reps.map(r => ({
      id: r._id.toString(),
      name: r.name,
      email: r.email,
      phone: r.phone || '',
      role: r.role,
      status: r.status,
      availability_status: r.availability_status || 'unavailable',
      createdAt: r.createdAt,
      user_type_id: r.user_type_id || null,
      repGroupIds: (r.rep_group_ids || []).map(id => id.toString()),
      allowedBotIds: (r.allowed_bot_ids || []).map(id => id.toString()),
      })),
      availableUserTypes
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/sub-users — create a new rep under the authenticated company manager
export const createSubUser = async (req, res) => {
  try {
    const managerId = await getRootManagerId(req.userId);
    const { name, email, password, phone, role, rep_group_ids, allowed_bot_ids, user_type_id, allowDuplicateEmail } = req.body;

    const actor = await User.findById(req.userId).select('role user_type_id').lean();
    const actorPerms = await resolvePermissions(actor || { role: req.user?.role });
    if (!hasPermission(actorPerms, 'users.add')) {
      return res.status(403).json({ error: 'אין הרשאה להוספת משתמשים' });
    }

    const actorType = actor?.user_type_id
      ? await UserType.findById(actor.user_type_id).lean()
      : actor?.role
        ? await UserType.findOne({ system_role: actor.role, is_seeded: true }).lean()
        : null;
    const canAddByType = !!actorType?.can_add_users;
    if (!canAddByType && actor?.role !== 'admin' && actor?.role !== 'user') {
      return res.status(403).json({ error: 'סוג המשתמש שלך אינו מורשה להוסיף משתמשים' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'שם, אימייל וסיסמה הם שדות חובה' });
    }

    if (!user_type_id) {
      return res.status(400).json({ error: 'יש לבחור סוג משתמש' });
    }

    const targetType = await UserType.findById(user_type_id).lean();
    if (!targetType) {
      return res.status(400).json({ error: 'סוג משתמש לא תקין' });
    }
    if (!targetType.show_in_users_tab) {
      return res.status(400).json({ error: 'סוג משתמש זה אינו זמין להוספה דרך לשונית משתמשים' });
    }

    const actorAllowedIds = Array.isArray(actorType?.allowed_user_type_ids)
      ? actorType.allowed_user_type_ids.map(id => id.toString())
      : [];
    if (actor?.role !== 'admin' && actorAllowedIds.length > 0 && !actorAllowedIds.includes(targetType._id.toString())) {
      return res.status(403).json({ error: 'אין הרשאה להוסיף משתמש מהסוג שנבחר' });
    }

    const effectiveRole = targetType.system_role || role;
    const allowedRoles = ['rep', 'rep_manager', 'user'];
    if (!allowedRoles.includes(effectiveRole)) {
      return res.status(400).json({ error: 'סוג המשתמש שנבחר אינו נתמך להוספה במסך זה' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingAccounts = await User.find({ email: normalizedEmail }).select('name account_type role createdAt');
    if (existingAccounts.length > 0 && allowDuplicateEmail !== true) {
      return res.status(409).json({
        emailExists: true,
        count: existingAccounts.length,
        accounts: existingAccounts.map(u => ({
          id: u._id.toString(),
          name: u.name,
          account_type: u.account_type || 'Basic',
          role: u.role || 'user',
          created_at: u.createdAt
        }))
      });
    }

    const publicId = Math.random().toString(36).substring(2, 15);
    const repData = {
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone || '',
      role: effectiveRole,
      user_type_id: targetType._id,
      manager_id: managerId,
      public_id: publicId,
      account_type: '',
      status: 'active',
    };
    if (effectiveRole === 'rep' && Array.isArray(rep_group_ids) && rep_group_ids.length > 0) {
      repData.rep_group_ids = rep_group_ids.map(id => new mongoose.Types.ObjectId(id));
    }
    if (effectiveRole === 'rep' && Array.isArray(allowed_bot_ids)) {
      repData.allowed_bot_ids = allowed_bot_ids.map(id => new mongoose.Types.ObjectId(id));
    }
    const rep = await User.create(repData);

    // Send invitation email if requested
    if (req.body.send_invite && rep.email) {
      try {
        const manager = await User.findById(managerId).select('name').lean();
        const managerName = (manager?.name || '').replace(/[<>'"]/g, '');
        const repNameSafe = rep.name.replace(/[<>'"]/g, '');
        const systemUrl = process.env.SYSTEM_URL || 'https://botwa.message.co.il/';
        const inviteLink = `${systemUrl}?name=${encodeURIComponent(managerName)}`;

        const emailUsername = process.env.MESERGO_EMAIL_USERNAME || 'admin@chatgo.live';
        const emailToken = process.env.MESERGO_EMAIL_TOKEN || '1aa14226-ceae-4104-ba86-899eca88631d';
        const fromAddress = process.env.MESERGO_FROM_ADDRESS || 'admin@chatgo.live';

        const subject = 'הוזמנת להצטרף למערכת';
        const htmlBody = `<div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <h2 style="color:#2563eb;">שלום ${repNameSafe},</h2>
  <p>הוזמנת להצטרף למערכת ניהול הבוטים של <strong>${managerName}</strong>.</p>
  <p>לחץ על הקישור הבא כדי להיכנס למערכת:</p>
  <a href="${inviteLink}" style="display:inline-block;background:#2563eb;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;margin:16px 0;">כניסה למערכת</a>
  <p style="margin-top:20px;color:#64748b;font-size:14px;">שם המשתמש שלך: <strong>${rep.email}</strong></p>
</div>`;

        const xmlString = `<InfoMailClient>
<SendEmails>
<User>
<Username>${emailUsername}</Username>
<Token>${emailToken}</Token>
</User>
<Message>
<CampaignName>הזמנת נציג - ${repNameSafe}</CampaignName>
<FromAddress>${fromAddress}</FromAddress>
<FromName>Bot Flow</FromName>
<Subject><![CDATA[${subject}]]></Subject>
<Body><![CDATA[${htmlBody}]]></Body>
</Message>
<Recipients>
<Email address="${rep.email}" />
</Recipients>
</SendEmails>
</InfoMailClient>`;

        const encodedXml = encodeURIComponent(xmlString);
        const mailUrl = `https://capi.mesergo.co.il/mail/api.php?xml=${encodedXml}`;
        await fetch(mailUrl, { method: 'GET' });
        console.log(`✅ Invite email sent to ${rep.email}`);
      } catch (mailErr) {
        console.error('❌ Failed to send invite email:', mailErr);
        // Don't fail the user creation — just log
      }
    }

    res.status(201).json({
      id: rep._id.toString(),
      name: rep.name,
      email: rep.email,
      phone: rep.phone || '',
      role: rep.role,
      status: rep.status,
      createdAt: rep.createdAt,
      user_type_id: rep.user_type_id || null,
      repGroupIds: (rep.rep_group_ids || []).map(id => id.toString()),
      allowedBotIds: (rep.allowed_bot_ids || []).map(id => id.toString()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/sub-users/:id — update a rep's details
export const updateSubUser = async (req, res) => {
  try {
    const managerId = await getRootManagerId(req.userId);
    const { id } = req.params;
    const { name, email, phone, role, password, rep_group_ids, allowed_bot_ids, allowDuplicateEmail } = req.body;

    const rep = await User.findOne({ _id: id, manager_id: managerId });
    if (!rep) {
      return res.status(404).json({ error: 'נציג לא נמצא' });
    }

    const allowedRoles = ['rep', 'rep_manager'];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ error: 'סוג משתמש לא תקין' });
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail !== rep.email) {
        // Multiple accounts are allowed to share the same login email (multi-account
        // feature) — so a match here is a warning to confirm, not a hard block, mirroring
        // the create-sub-user flow below.
        const existingAccounts = await User.find({ email: normalizedEmail, _id: { $ne: rep._id } })
          .select('name account_type role createdAt');
        if (existingAccounts.length > 0 && allowDuplicateEmail !== true) {
          return res.status(409).json({
            emailExists: true,
            count: existingAccounts.length,
            accounts: existingAccounts.map(u => ({
              id: u._id.toString(),
              name: u.name,
              account_type: u.account_type || 'Basic',
              role: u.role || 'user',
              created_at: u.createdAt
            }))
          });
        }
        rep.email = normalizedEmail;
      }
    }
    if (name && name.trim()) rep.name = name.trim();
    if (phone !== undefined) rep.phone = phone;
    if (role) rep.role = role;
    if (password && password.trim()) rep.password = password.trim();
    // rep_group_ids: rep_managers always get []; reps get the provided array if sent
    if (rep.role === 'rep_manager') {
      rep.rep_group_ids = [];
    } else if (rep.role === 'rep' && rep_group_ids !== undefined) {
      rep.rep_group_ids = Array.isArray(rep_group_ids)
        ? rep_group_ids.map(id => new mongoose.Types.ObjectId(id))
        : [];
    }
    // allowed_bot_ids: only meaningful for reps
    if (rep.role === 'rep' && allowed_bot_ids !== undefined) {
      rep.allowed_bot_ids = Array.isArray(allowed_bot_ids)
        ? allowed_bot_ids.map(id => new mongoose.Types.ObjectId(id))
        : [];
    } else if (rep.role === 'rep_manager') {
      rep.allowed_bot_ids = [];
    }

    await rep.save();
    res.json({
      id: rep._id.toString(),
      name: rep.name,
      email: rep.email,
      phone: rep.phone || '',
      role: rep.role,
      status: rep.status,
      createdAt: rep.createdAt,
      repGroupIds: (rep.rep_group_ids || []).map(id => id.toString()),
      allowedBotIds: (rep.allowed_bot_ids || []).map(id => id.toString()),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/sub-users/:id — delete a rep
export const deleteSubUser = async (req, res) => {
  try {
    const managerId = await getRootManagerId(req.userId);
    const { id } = req.params;

    const rep = await User.findOne({ _id: id, manager_id: managerId });
    if (!rep) {
      return res.status(404).json({ error: 'נציג לא נמצא' });
    }

    await User.deleteOne({ _id: id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
