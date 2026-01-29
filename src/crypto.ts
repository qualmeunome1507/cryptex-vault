/**
 * Cryptex Vault - Core Cryptography Module (Streaming Edition)
 * Uses Web Crypto API for secure, client-side encryption.
 * Supports large files via chunked processing.
 */

const ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ALGO = 'AES-GCM';
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

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
 * Increments the IV for chunked encryption.
 */
function incrementIV(iv: Uint8Array, chunkIndex: number) {
    const newIv = new Uint8Array(iv);
    let counter = chunkIndex;
    for (let i = 11; i >= 0 && counter > 0; i--) {
        const sum = newIv[i] + (counter % 256);
        newIv[i] = sum % 256;
        counter = Math.floor(counter / 256) + Math.floor(sum / 256);
    }
    return newIv;
}

/**
 * Encrypts a File in chunks.
 */
export async function encryptFile(
    file: File,
    password: string,
    onProgress?: (progress: number) => void
): Promise<Blob> {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const key = await deriveKey(password, salt);

    const encryptedChunks: BlobPart[] = [salt, iv];
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = await file.slice(start, end).arrayBuffer();

        const chunkIv = incrementIV(iv, i);
        const encryptedChunk = await crypto.subtle.encrypt(
            { name: ALGO, iv: chunkIv as any },
            key,
            chunk
        );

        encryptedChunks.push(encryptedChunk);
        if (onProgress) onProgress(((i + 1) / totalChunks) * 100);
    }

    return new Blob(encryptedChunks, { type: 'application/octet-stream' });
}

/**
 * Decrypts an encrypted File/Blob in chunks.
 */
export async function decryptFile(
    encryptedBlob: Blob,
    password: string,
    originalFileName: string,
    originalFileType: string,
    onProgress?: (progress: number) => void
): Promise<File> {
    const headerBuffer = await encryptedBlob.slice(0, SALT_LENGTH + IV_LENGTH).arrayBuffer();
    const salt = new Uint8Array(headerBuffer.slice(0, SALT_LENGTH));
    const iv = new Uint8Array(headerBuffer.slice(SALT_LENGTH));

    const key = await deriveKey(password, salt);
    const decryptedChunks: BlobPart[] = [];

    // Each encrypted chunk is CHUNK_SIZE + 16 bytes (auth tag)
    const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + 16;
    const bodyBlob = encryptedBlob.slice(SALT_LENGTH + IV_LENGTH);
    const totalChunks = Math.ceil(bodyBlob.size / ENCRYPTED_CHUNK_SIZE);

    try {
        for (let i = 0; i < totalChunks; i++) {
            const start = i * ENCRYPTED_CHUNK_SIZE;
            const end = Math.min(start + ENCRYPTED_CHUNK_SIZE, bodyBlob.size);
            const encryptedChunk = await bodyBlob.slice(start, end).arrayBuffer();

            const chunkIv = incrementIV(iv, i);
            const decryptedChunk = await crypto.subtle.decrypt(
                { name: ALGO, iv: chunkIv as any },
                key,
                encryptedChunk
            );

            decryptedChunks.push(decryptedChunk);
            if (onProgress) onProgress(((i + 1) / totalChunks) * 100);
        }
        return new File(decryptedChunks, originalFileName, { type: originalFileType });
    } catch (error) {
        throw new Error('Falha na decriptação. Senha incorreta ou arquivo corrompido.');
    }
}
