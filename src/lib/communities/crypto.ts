import {
  bufferToBase64,
  base64ToBuffer,
  importPeerPublicKey,
  deriveSharedSessionKey,
  encryptE2EEMessage,
  decryptE2EEMessage,
  EncryptedMessagePayload,
} from "@/lib/e2ee/crypto";

export interface ChannelKeyEnvelope {
  ciphertext: string; // Base64
  iv: string;         // Base64
  salt?: string;
}

export interface ChannelEncryptedPayload {
  ciphertext: string;
  iv: string;
  keyEpoch: number;
}

/**
 * Generates a fresh random 256-bit AES-GCM channel key
 */
export async function generateChannelKey(): Promise<CryptoKey> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    throw new Error("WebCrypto is only available in browser context");
  }

  return await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true, // Extractable for local enveloping and vault caching
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports a channel key to Base64
 */
export async function exportChannelKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("raw", key);
  return bufferToBase64(exported);
}

/**
 * Imports a raw Base64 channel key
 */
export async function importChannelKey(rawBase64: string): Promise<CryptoKey> {
  const buffer = base64ToBuffer(rawBase64);
  return await window.crypto.subtle.importKey(
    "raw",
    buffer,
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a channel key for a member device using ECDH + HKDF
 */
export async function createKeyEnvelopeForDevice(
  channelKeyRawBase64: string,
  localPrivateKey: CryptoKey,
  recipientPublicKeySpkiBase64: string
): Promise<ChannelKeyEnvelope> {
  const recipientPubKey = await importPeerPublicKey(recipientPublicKeySpkiBase64);
  const sharedSessionKey = await deriveSharedSessionKey(
    localPrivateKey,
    recipientPubKey,
    "Community-Channel-Key-Envelope-v1"
  );

  return await encryptE2EEMessage(sharedSessionKey, channelKeyRawBase64);
}

/**
 * Decrypts a channel key envelope received for local device
 */
export async function unpackKeyEnvelope(
  envelope: ChannelKeyEnvelope,
  localPrivateKey: CryptoKey,
  senderPublicKeySpkiBase64: string
): Promise<CryptoKey> {
  const senderPubKey = await importPeerPublicKey(senderPublicKeySpkiBase64);
  const sharedSessionKey = await deriveSharedSessionKey(
    localPrivateKey,
    senderPubKey,
    "Community-Channel-Key-Envelope-v1"
  );

  const rawKeyBase64 = await decryptE2EEMessage(sharedSessionKey, envelope);
  return await importChannelKey(rawKeyBase64);
}

/**
 * Encrypts a community channel message using the active channel symmetric key
 */
export async function encryptChannelMessage(
  channelKey: CryptoKey,
  plaintext: string,
  keyEpoch: number
): Promise<ChannelEncryptedPayload> {
  const payload = await encryptE2EEMessage(channelKey, plaintext);
  return {
    ciphertext: payload.ciphertext,
    iv: payload.iv,
    keyEpoch,
  };
}

/**
 * Decrypts a community channel message
 */
export async function decryptChannelMessage(
  channelKey: CryptoKey,
  payload: { ciphertext: string; iv: string }
): Promise<string> {
  return await decryptE2EEMessage(channelKey, {
    ciphertext: payload.ciphertext,
    iv: payload.iv,
  });
}
