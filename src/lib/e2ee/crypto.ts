/**
 * Production WebCryptographic Engine for End-to-End Encryption (E2EE)
 * Follows NIST P-256 Elliptic Curve Diffie-Hellman (ECDH) + HKDF + AES-256-GCM
 * Runs natively in modern browsers, Android WebView, and iOS WKWebView.
 */

// Helper: ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface DeviceKeyPair {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicKeyBase64: string;
}

export interface EncryptedMessagePayload {
  ciphertext: string; // Base64
  iv: string;         // Base64
  salt?: string;      // Base64
}

/**
 * Generates an ECDH P-256 Device Key Pair
 */
export async function generateDeviceKeyPair(): Promise<DeviceKeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true, // Extractable for local encrypted IndexedDB storage
    ["deriveKey", "deriveBits"]
  );

  const exportedPublic = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
  const publicKeyBase64 = bufferToBase64(exportedPublic);

  return {
    publicKey: keyPair.publicKey,
    privateKey: keyPair.privateKey,
    publicKeyBase64,
  };
}

/**
 * Imports a remote peer's public key from SPKI Base64 format
 */
export async function importPeerPublicKey(spkiBase64: string): Promise<CryptoKey> {
  const keyBuffer = base64ToBuffer(spkiBase64);
  return await window.crypto.subtle.importKey(
    "spki",
    keyBuffer,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    []
  );
}

/**
 * Exports a private key to PKCS8 Base64 format (for local secure vault only)
 */
export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("pkcs8", key);
  return bufferToBase64(exported);
}

/**
 * Imports a private key from PKCS8 Base64 format
 */
export async function importPrivateKey(pkcs8Base64: string): Promise<CryptoKey> {
  const buffer = base64ToBuffer(pkcs8Base64);
  return await window.crypto.subtle.importKey(
    "pkcs8",
    buffer,
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"]
  );
}

/**
 * Derives a 256-bit AES-GCM symmetric session key from local private key and remote public key
 * using ECDH + HKDF (SHA-256)
 */
export async function deriveSharedSessionKey(
  localPrivateKey: CryptoKey,
  remotePublicKey: CryptoKey,
  saltStr = "Alumni-E2EE-Salt-v1"
): Promise<CryptoKey> {
  // 1. Derive shared secret bits via ECDH
  const sharedSecretBits = await window.crypto.subtle.deriveBits(
    {
      name: "ECDH",
      public: remotePublicKey,
    },
    localPrivateKey,
    256
  );

  // 2. Import shared bits as raw key material for HKDF
  const hkdfKeyMaterial = await window.crypto.subtle.importKey(
    "raw",
    sharedSecretBits,
    "HKDF",
    false,
    ["deriveKey"]
  );

  const encoder = new TextEncoder();
  const salt = encoder.encode(saltStr);
  const info = encoder.encode("Alumni-P2P-Encrypted-Chat");

  // 3. Derive AES-GCM 256-bit key
  return await window.crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info,
    },
    hkdfKeyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false, // Non-exportable session key
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts arbitrary text or structured JSON using AES-256-GCM
 * Generates fresh 12-byte cryptographically secure random IV for each message
 */
export async function encryptE2EEMessage(
  sharedKey: CryptoKey,
  plaintext: string
): Promise<EncryptedMessagePayload> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // 96-bit (12-byte) initialization vector as recommended for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    sharedKey,
    data
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv),
  };
}

/**
 * Decrypts an AES-256-GCM payload.
 * Throws an error if ciphertext or IV has been tampered with (Auth Tag verification).
 */
export async function decryptE2EEMessage(
  sharedKey: CryptoKey,
  payload: EncryptedMessagePayload
): Promise<string> {
  const ciphertextBuffer = base64ToBuffer(payload.ciphertext);
  const ivBuffer = base64ToBuffer(payload.iv);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: new Uint8Array(ivBuffer),
    },
    sharedKey,
    ciphertextBuffer
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

/**
 * Computes a Signal/Telegram style safety number (verification fingerprint)
 * from both public keys so users can verify encryption in person or via call.
 */
export async function generateSafetyNumber(
  localPubKeyBase64: string,
  remotePubKeyBase64: string
): Promise<string> {
  // Sort keys deterministically so both users compute the exact same fingerprint
  const sorted = [localPubKeyBase64, remotePubKeyBase64].sort().join(":");
  const encoder = new TextEncoder();
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", encoder.encode(sorted));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  // Format as 6 blocks of 5 digits (30 digits total)
  let digits = "";
  for (let i = 0; i < hashArray.length && digits.length < 30; i++) {
    digits += hashArray[i].toString().padStart(3, "0");
  }
  const cleanDigits = digits.slice(0, 30);
  return cleanDigits.match(/.{1,5}/g)?.join(" ") || cleanDigits;
}
