
export class SecureMemory {
  private data: ArrayBuffer | null = null;
  private isValid: boolean = true;

  constructor(privateKey: string) {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(privateKey).buffer.slice(0);
    this.data = buffer instanceof ArrayBuffer ? buffer : (buffer as unknown as ArrayBuffer);
  }

  async use<T>(callback: (key: string) => Promise<T>): Promise<T> {
    if (!this.isValid || !this.data) {
      throw new Error('SecureMemory: I dati non sono più validi o sono stati distrutti.');
    }

    const decoder = new TextDecoder();
    const key = decoder.decode(this.data);
    
    try {

      return await callback(key);
    } finally {
      this.destroy();
    }
  }

  destroy() {
    if (this.data) {
      const view = new Uint8Array(this.data);
      crypto.getRandomValues(view);
      this.data = null;
    }
    this.isValid = false;
  }

  isDestroyed(): boolean {
    return !this.isValid;
  }
}

export const decryptPrivateKeySecurely = async (phrase: string): Promise<SecureMemory | null> => {
  console.log('[DEBUG] Inizio decifratura con passphrase:', phrase.substring(0, 5) + '...');
  try {
    const ENCRYPTED_PRIVATE_KEY = process.env.NEXT_PUBLIC_ENCRYPTED_PRIVATE_KEY as string;
    
    if (!ENCRYPTED_PRIVATE_KEY) {
      console.error('[DEBUG] Chiave cifrata non configurata');
      throw new Error('Chiave cifrata non configurata');
    }

    const encryptedData = Uint8Array.from(atob(ENCRYPTED_PRIVATE_KEY), c => c.charCodeAt(0));
    const salt = encryptedData.slice(0, 16);
    const iv = encryptedData.slice(16, 28);
    const authTag = encryptedData.slice(28, 44);
    const ciphertext = encryptedData.slice(44);

    console.log('[DEBUG] Lunghezze: Salt:', salt.length, 'IV:', iv.length, 'AuthTag:', authTag.length, 'Ciphertext:', ciphertext.length);

    const passwordKey = await crypto.subtle.importKey(
      'raw', 
      new TextEncoder().encode(phrase), 
      'PBKDF2', 
      false, 
      ['deriveKey']
    );
    
    const derivedKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['decrypt']
    );

    const dataToDecrypt = new Uint8Array(ciphertext.length + authTag.length);
    dataToDecrypt.set(ciphertext, 0);
    dataToDecrypt.set(authTag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, 
      derivedKey, 
      dataToDecrypt
    );
    
    const privateKey = new TextDecoder().decode(decrypted);
    console.log('[DEBUG] Decifratura completata con successo');
    
    if (!privateKey.match(/^(0x)?[a-fA-F0-9]{64}$/)) {
      console.error('[DEBUG] Formato chiave non valido');
      throw new Error('Formato chiave privata non valido');
    }

    return new SecureMemory(privateKey);
    
  } catch (error) {
    console.error('[DEBUG] Errore decifratura dettagliato:', error);
    return null;
  }
};