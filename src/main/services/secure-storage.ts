import { safeStorage } from 'electron';

const ENCRYPTED_PREFIX = 'enc:';

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function encryptString(plaintext: string): string {
  if (plaintext === '') return plaintext;
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext;
  if (!isEncryptionAvailable()) {
    console.warn('[secure-storage] Encryption not available, storing plaintext');
    return plaintext;
  }
  try {
    const encrypted = safeStorage.encryptString(plaintext);
    return ENCRYPTED_PREFIX + encrypted.toString('base64');
  } catch (e) {
    throw new Error(`[secure-storage] Failed to encrypt value: ${e}`);
  }
}

export function decryptString(ciphertext: string): string {
  if (typeof ciphertext !== 'string') return '';
  if (ciphertext === '') return ciphertext;

  // If it was stored as plaintext (no prefix), return as-is
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) {
    return ciphertext;
  }

  const payload = ciphertext.slice(ENCRYPTED_PREFIX.length);

  if (!isEncryptionAvailable()) {
    throw new Error('[secure-storage] Encryption is unavailable but value is encrypted');
  }

  try {
    const buffer = Buffer.from(payload, 'base64');
    return safeStorage.decryptString(buffer);
  } catch (e) {
    throw new Error(`[secure-storage] Failed to decrypt value: ${e}`);
  }
}
