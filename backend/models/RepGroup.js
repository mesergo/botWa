import mongoose from 'mongoose';

// One working-hours entry per day of week (index = 0..6 = Sunday..Saturday).
const workingHoursDaySchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  from:    { type: String,  default: '09:00' }, // "HH:mm" — Israel local time
  to:      { type: String,  default: '17:00' },
}, { _id: false });

const repGroupSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  manager_id: { type: String, required: true },

  // ── General settings ("ניהול נציגים → קבוצות נציגים → הגדרות") ──
  openingMessage:     { type: String, default: '' },
  closingMessage:     { type: String, default: '' },
  unavailableMessage: { type: String, default: '' },
  workingHours: {
    enabled: { type: Boolean, default: false },
    days:    { type: [workingHoursDaySchema], default: undefined },
  },
}, {
  timestamps: true,
  collection: 'RepGroup',
});

export default mongoose.model('RepGroup', repGroupSchema);
