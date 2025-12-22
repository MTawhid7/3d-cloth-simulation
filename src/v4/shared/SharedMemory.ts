// src/v4/shared/SharedMemory.ts

export const SHARED_OFFSET = {
    POSITIONS: 0,
    PREV_POSITIONS: 1,
    INV_MASS: 2,
};

export type SharedBuffers = {
    positions: Float32Array;
    prevPositions: Float32Array;
    invMass: Float32Array;
};

export function createSharedBuffers(vertexCount: number): { buffer: SharedArrayBuffer, views: SharedBuffers } {
    // 🛡️ SAFETY CHECK
    if (typeof SharedArrayBuffer === 'undefined') {
        throw new Error(
            "❌ SharedArrayBuffer is not defined. Your browser is not Cross-Origin Isolated.\n" +
            "Check vite.config.ts headers: 'Cross-Origin-Opener-Policy': 'same-origin' and 'Cross-Origin-Embedder-Policy': 'require-corp'"
        );
    }

    const floatCount = vertexCount * 7;
    const byteLength = floatCount * 4;

    const buffer = new SharedArrayBuffer(byteLength);
    const float32View = new Float32Array(buffer);

    const posSize = vertexCount * 3;

    const positions = float32View.subarray(0, posSize);
    const prevPositions = float32View.subarray(posSize, posSize * 2);
    const invMass = float32View.subarray(posSize * 2, posSize * 2 + vertexCount);

    return {
        buffer,
        views: { positions, prevPositions, invMass }
    };
}

export function mapSharedBuffers(buffer: SharedArrayBuffer, vertexCount: number): SharedBuffers {
    const float32View = new Float32Array(buffer);
    const posSize = vertexCount * 3;

    return {
        positions: float32View.subarray(0, posSize),
        prevPositions: float32View.subarray(posSize, posSize * 2),
        invMass: float32View.subarray(posSize * 2, posSize * 2 + vertexCount)
    };
}