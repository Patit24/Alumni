/**
 * Zero-Knowledge Client-Side E2EE Media Attachment Engine.
 * Encrypts files client-side using WebCrypto AES-GCM (256-bit) before upload.
 * The server only receives and hosts an unreadable ciphertext blob.
 * Decryption key is transmitted strictly out-of-band inside the peer's E2EE message.
 */

export interface EncryptedMediaMetadata {
  ciphertextUrl: string;
  keyBase64: string;
  ivBase64: string;
  mimeType: string;
  fileName: string;
  fileSize: number;
}

/**
 * Encrypts a File client-side with AES-256-GCM and uploads ciphertext blob to storage.
 */
export async function encryptAndUploadMedia(
  file: File,
  category: "chats" | "groups" = "chats"
): Promise<EncryptedMediaMetadata> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("WebCrypto is not supported in this runtime environment.");
  }

  // 1. Generate ephemeral 256-bit AES-GCM key and 12-byte IV
  const key = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 2. Read file as ArrayBuffer and encrypt
  const fileBuffer = await file.arrayBuffer();
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileBuffer
  );

  // 3. Export key to Raw -> Base64
  const rawKey = await window.crypto.subtle.exportKey("raw", key);
  const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(rawKey)));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  // 4. Upload ciphertext blob to storage API
  const ciphertextBlob = new Blob([ciphertextBuffer], { type: "application/octet-stream" });
  const formData = new FormData();
  formData.append("file", ciphertextBlob, "encrypted_media.bin");
  formData.append("category", category);

  const res = await fetch("/api/storage/upload", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to upload encrypted media");
  }

  const data = await res.json();

  return {
    ciphertextUrl: data.url,
    keyBase64,
    ivBase64,
    mimeType: file.type || "application/octet-stream",
    fileName: file.name,
    fileSize: file.size,
  };
}

/**
 * Fetches ciphertext from storage and decrypts it locally in client memory.
 * Returns a browser Object URL (blob:...) suitable for <img>, <a>, or <video> tags.
 */
export async function fetchAndDecryptMedia(
  metadata: EncryptedMediaMetadata
): Promise<string> {
  if (typeof window === "undefined" || !window.crypto || !window.crypto.subtle) {
    throw new Error("WebCrypto is not supported in this runtime environment.");
  }

  // 1. Fetch ciphertext from storage
  const res = await fetch(metadata.ciphertextUrl);
  if (!res.ok) {
    throw new Error(`Failed to download encrypted attachment: ${res.statusText}`);
  }
  const ciphertextBuffer = await res.arrayBuffer();

  // 2. Decode key and IV
  const keyBytes = Uint8Array.from(atob(metadata.keyBase64), (c) => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(metadata.ivBase64), (c) => c.charCodeAt(0));

  // 3. Import key
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  // 4. Decrypt in memory
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    cryptoKey,
    ciphertextBuffer
  );

  // 5. Create local Blob and Object URL
  const blob = new Blob([decryptedBuffer], { type: metadata.mimeType });
  return URL.createObjectURL(blob);
}
