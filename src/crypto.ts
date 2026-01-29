/**
 * Cryptex Vault - Core Cryptography Module
 * Uses Web Crypto API for secure, client-side encryption.
 */

const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ALGO = 'AES-GCM';

/**
 * Derives a cryptographic key from a password.
 */
async function deriveKey(password: string, salt: Uint8Array) {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    const baseKey = await crypto.subtle.importKey(
        'raw',
        passwordData,
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    return crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as any,
            iterations: ITERATIONS,
            hash: 'SHA-256',
        },
        baseKey,
        { name: ALGO, length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts a File and returns a Blob containing [Salt][IV][Ciphertext].
 */
export async function encryptFile(file: File, password: string): Promise<Blob> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveKey(password, salt);

    const fileData = await file.arrayBuffer();
    const encryptedData = await crypto.subtle.encrypt(
        { name: ALGO, iv: iv as any },
        key,
        fileData
    );

    return new Blob([salt, iv, encryptedData], { type: 'application/octet-stream' });
}

/**
 * Decrypts a Blob/Buffer and returns the original data as a Blob.
 */
export async function decryptFile(
    encryptedBlob: Blob,
    password: string,
    originalFileName: string,
    originalFileType: string
): Promise<File> {
    const buffer = await encryptedBlob.arrayBuffer();
    const salt = new Uint8Array(buffer.slice(0, SALT_LENGTH));
    const iv = new Uint8Array(buffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH));
    const ciphertext = buffer.slice(SALT_LENGTH + IV_LENGTH);

    const key = await deriveKey(password, salt);

    try {
        const decryptedData = await crypto.subtle.decrypt(
            { name: ALGO, iv: iv as any },
            key,
            ciphertext
        );
        return new File([decryptedData], originalFileName, { type: originalFileType });
    } catch (error) {
        throw new Error('Falha na decriptação. Senha incorreta ou arquivo corrompido.');
    }
}
