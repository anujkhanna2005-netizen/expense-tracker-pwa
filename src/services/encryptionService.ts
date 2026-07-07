// encryptionService.ts using Web Crypto API (SubtleCrypto)
let sessionKey: CryptoKey | null = null;

// Helper to convert ArrayBuffer to Hex string
function bufToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper to convert Hex string to ArrayBuffer
function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export const encryptionService = {
  generateSalt(): string {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return bufToHex(arr.buffer);
  },

  async deriveBaseKey(pin: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);
    return await crypto.subtle.importKey(
      'raw',
      pinData,
      'PBKDF2',
      false,
      ['deriveKey', 'deriveBits']
    );
  },

  async derivePinHash(pin: string, saltHex: string): Promise<string> {
    const baseKey = await this.deriveBaseKey(pin);
    const salt = hexToBuf(saltHex);
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      } as any,
      baseKey,
      256
    );
    return bufToHex(derivedBits);
  },

  async deriveSessionKey(pin: string, saltHex: string): Promise<CryptoKey> {
    const baseKey = await this.deriveBaseKey(pin);
    const salt = hexToBuf(saltHex);
    // Derive AES-GCM 256-bit key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      } as any,
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    sessionKey = key;
    return key;
  },

  setSessionKey(key: CryptoKey | null) {
    sessionKey = key;
  },

  hasSessionKey(): boolean {
    return sessionKey !== null;
  },

  async encrypt(plaintext: string): Promise<string> {
    if (!sessionKey) {
      throw new Error('Encryption key not loaded in session');
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      sessionKey,
      data
    );

    const ivHex = bufToHex(iv.buffer);
    const cipherHex = bufToHex(ciphertext);
    return `${ivHex}:${cipherHex}`;
  },

  async decrypt(encryptedStr: string): Promise<string> {
    if (!sessionKey) {
      throw new Error('Decryption key not loaded in session');
    }
    const parts = encryptedStr.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }

    const iv = hexToBuf(parts[0]);
    const ciphertext = hexToBuf(parts[1]);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      } as any,
      sessionKey,
      ciphertext as any
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
};
