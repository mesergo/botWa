import mongoose from 'mongoose';

// One-time codes for phone-number login (OTP sent via WhatsApp).
// `phone_key` is the last 9 digits (digits-only) of the phone used to request the code —
// see phoneKeyOf() in authController.js for the matching normalization logic.
const phoneOtpSchema = new mongoose.Schema({
  phone_key: { type: String, required: true, index: true },
  code_hash: { type: String, required: true },
  otp_expires_at: { type: Date, required: true },
  created_at: { type: Date, default: Date.now },
  attempts: { type: Number, default: 0 },
  consumed: { type: Boolean, default: false }
});

// TTL cleanup ~15 min after creation — longer than both the 5-min OTP validity
// window and the 10-min rate-limit window, so rate-limit counting is never
// undercounted by premature Mongo TTL cleanup.
phoneOtpSchema.index({ created_at: 1 }, { expireAfterSeconds: 900 });

export default mongoose.model('PhoneOtp', phoneOtpSchema);
