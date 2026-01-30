/**
 * Cryptex Vault - Core Cryptography Module (Streaming Edition)
 * Uses Web Crypto API for secure, client-side encryption.
 * Supports large files via chunked processing.
 */

const ITERATIONS = 600000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const ALGO = 'AES-GCM';
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const MAGIC = 'CRYPTEXV';
const MAGIC_BYTES = new TextEncoder().encode(MAGIC);
const FOOTER_SIZE = 12; // 4 bytes for length + 8 bytes for MAGIC

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
 * Encrypts a File in chunks with encrypted metadata.
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

    // 1. Encrypt Metadata
    const metadata = JSON.stringify({
        name: file.name,
        type: file.type || 'application/octet-stream'
    });
    const metadataEncoder = new TextEncoder();
    const metadataData = metadataEncoder.encode(metadata);

    // Using a special IV for metadata or just incrementing? Let's use incrementIV with index -1 for header if we want to be fancy, 
    // but for simplicity and robustness we'll use index 0 and start file chunks from 1.
    const metadataIv = incrementIV(iv, 0);
    const encryptedMetadata = await crypto.subtle.encrypt(
        { name: ALGO, iv: metadataIv as any },
        key,
        metadataData
    );

    // Prefix metadata length (4 bytes) + encrypted metadata
    const metaSize = new Uint32Array([encryptedMetadata.byteLength]);
    encryptedChunks.push(metaSize, encryptedMetadata);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = await file.slice(start, end).arrayBuffer();

        // Data chunks start from index 1 to avoid IV reuse with metadata
        const chunkIv = incrementIV(iv, i + 1);
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
 * Decrypts an encrypted File/Blob in chunks and restores original metadata.
 */
export async function decryptFile(
    encryptedBlob: Blob,
    password: string,
    onProgress?: (progress: number) => void
): Promise<File> {
    const headerSize = SALT_LENGTH + IV_LENGTH;
    const headerBuffer = await encryptedBlob.slice(0, headerSize).arrayBuffer();
    const salt = new Uint8Array(headerBuffer.slice(0, SALT_LENGTH));
    const iv = new Uint8Array(headerBuffer.slice(SALT_LENGTH));

    const key = await deriveKey(password, salt);

    // 2. Decrypt Metadata
    const metaLengthBuffer = await encryptedBlob.slice(headerSize, headerSize + 4).arrayBuffer();
    const metadataLength = new Uint32Array(metaLengthBuffer)[0];

    const encryptedMetadata = await encryptedBlob.slice(headerSize + 4, headerSize + 4 + metadataLength).arrayBuffer();
    const metadataIv = incrementIV(iv, 0);

    let originalMetadata: { name: string, type: string };
    try {
        const decryptedMetadata = await crypto.subtle.decrypt(
            { name: ALGO, iv: metadataIv as any },
            key,
            encryptedMetadata
        );
        const decoder = new TextDecoder();
        originalMetadata = JSON.parse(decoder.decode(decryptedMetadata));
    } catch (e) {
        throw new Error('Falha na decriptação. Senha incorreta ou arquivo corrompido.');
    }

    const decryptedChunks: BlobPart[] = [];
    const ENCRYPTED_CHUNK_SIZE = CHUNK_SIZE + 16;
    const dataStart = headerSize + 4 + metadataLength;
    const bodyBlob = encryptedBlob.slice(dataStart);
    const totalChunks = Math.ceil(bodyBlob.size / ENCRYPTED_CHUNK_SIZE);

    try {
        for (let i = 0; i < totalChunks; i++) {
            const start = i * ENCRYPTED_CHUNK_SIZE;
            const end = Math.min(start + ENCRYPTED_CHUNK_SIZE, bodyBlob.size);
            const encryptedChunk = await bodyBlob.slice(start, end).arrayBuffer();

            const chunkIv = incrementIV(iv, i + 1);
            const decryptedChunk = await crypto.subtle.decrypt(
                { name: ALGO, iv: chunkIv as any },
                key,
                encryptedChunk
            );

            decryptedChunks.push(decryptedChunk);
            if (onProgress) onProgress(((i + 1) / totalChunks) * 100);
        }
        return new File(decryptedChunks, originalMetadata.name, { type: originalMetadata.type });
    } catch (error) {
        throw new Error('Falha na decriptação dos dados. Arquivo pode estar incompleto.');
    }
}

/**
 * Wraps an encrypted Blob into a carrier PNG image.
 */
export async function wrapInImage(encryptedBlob: Blob, carrierUrl: string): Promise<Blob> {
    const response = await fetch(carrierUrl);
    const carrierBuffer = await response.arrayBuffer();
    const payloadBuffer = await encryptedBlob.arrayBuffer();

    const footer = new Uint8Array(FOOTER_SIZE);
    const view = new DataView(footer.buffer);
    view.setUint32(0, payloadBuffer.byteLength, true); // Little endian
    footer.set(MAGIC_BYTES, 4);

    return new Blob([carrierBuffer, payloadBuffer, footer], { type: 'image/png' });
}

/**
 * Unwraps an encrypted Blob from a carrier PNG image.
 */
export async function unwrapFromImage(imageBlob: Blob): Promise<Blob> {
    const buffer = await imageBlob.arrayBuffer();
    const view = new DataView(buffer);

    if (buffer.byteLength < FOOTER_SIZE) {
        throw new Error('Arquivo muito pequeno para ser um Vault camuflado.');
    }

    // Check magic
    const marker = new Uint8Array(buffer.slice(-8));
    if (new TextDecoder().decode(marker) !== MAGIC) {
        // If no magic, assume it's a standard .ctx file
        return imageBlob;
    }

    const payloadLength = view.getUint32(buffer.byteLength - FOOTER_SIZE, true);
    const payloadStart = buffer.byteLength - FOOTER_SIZE - payloadLength;

    if (payloadStart < 0) {
        throw new Error('Formato de camuflagem inválido ou corrompido.');
    }

    return new Blob([buffer.slice(payloadStart, payloadStart + payloadLength)], { type: 'application/octet-stream' });
}
