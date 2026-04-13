import { safeStorage } from 'electron';

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function encryptString(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (!isEncryptionAvailable()) {
    console.warn('[secure-storage] Encryption not available, storing plaintext');
    return plaintext;
  }
  const encrypted = safeStorage.encryptString(plaintext);
  return encrypted.toString('base64');
}

export function decryptString(ciphertext: string): string {
  if (!ciphertext) return ciphertext;
  if (!isEncryptionAvailable()) {
    return ciphertext;
  }
  const buffer = Buffer.from(ciphertext, 'base64');
  return safeStorage.decryptString(buffer);
}
