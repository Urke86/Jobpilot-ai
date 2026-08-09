/** AES-256-GCM helpers for Google OAuth token at-rest encryption. */

export function getEncryptionKeyBytes(): Uint8Array {
  const raw = Deno.env.get('GOOGLE_TOKEN_ENCRYPTION_KEY')?.trim();
  if (!raw) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY is not configured.');
  }
  // Accept 64-char hex or raw 32-byte string
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    const out = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      out[i] = parseInt(raw.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
  }
  const enc = new TextEncoder().encode(raw);
  if (enc.length < 32) {
    throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be 32 bytes or 64 hex chars.');
  }
  return enc.slice(0, 32);
}

function b64Encode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plaintext: string): Promise<{
  cipher: string;
  iv: string;
}> {
  const keyBytes = getEncryptionKeyBytes();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  return { cipher: b64Encode(encrypted), iv: b64Encode(iv) };
}

export async function decryptSecret(
  cipherB64: string,
  ivB64: string,
): Promise<string> {
  const keyBytes = getEncryptionKeyBytes();
  const iv = b64Decode(ivB64);
  const cipher = b64Decode(cipherB64);
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipher,
  );
  return new TextDecoder().decode(plain);
}

/** Pack access+refresh with shared IV family: store access cipher, refresh cipher, access iv; refresh iv derived stored in metadata or same packing. */
export async function encryptTokenPair(
  accessToken: string,
  refreshToken: string | null,
): Promise<{
  access_token_cipher: string;
  refresh_token_cipher: string | null;
  token_iv: string;
}> {
  const access = await encryptSecret(accessToken);
  let refreshCipher: string | null = null;
  let refreshIv = '';
  if (refreshToken) {
    const refresh = await encryptSecret(refreshToken);
    refreshCipher = `${refresh.iv}.${refresh.cipher}`;
    refreshIv = refresh.iv;
  }
  return {
    access_token_cipher: access.cipher,
    refresh_token_cipher: refreshCipher,
    token_iv: access.iv + (refreshIv ? `|${refreshIv}` : ''),
  };
}

export async function decryptAccessToken(
  accessCipher: string,
  tokenIv: string,
): Promise<string> {
  const accessIv = tokenIv.split('|')[0];
  return decryptSecret(accessCipher, accessIv);
}

export async function decryptRefreshToken(
  refreshPacked: string | null,
): Promise<string | null> {
  if (!refreshPacked) return null;
  const [iv, cipher] = refreshPacked.split('.');
  if (!iv || !cipher) return null;
  return decryptSecret(cipher, iv);
}
