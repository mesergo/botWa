import bcrypt from 'bcryptjs';

const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;

export async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, 10);
}

// Verifies a plain-text password against a stored value that may be either a
// bcrypt hash (new signups) or legacy plain text (accounts created before
// hashing was introduced). No migration needed — both keep working.
export async function verifyPassword(plainPassword, storedPassword) {
  if (!plainPassword || !storedPassword) return false;
  if (BCRYPT_HASH_REGEX.test(storedPassword)) {
    return bcrypt.compare(plainPassword, storedPassword);
  }
  return plainPassword === storedPassword;
}
