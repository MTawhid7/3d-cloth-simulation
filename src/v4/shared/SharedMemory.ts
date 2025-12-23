export const SHARED_OFFSET = {
    POSITIONS: 0,
    PREV_POSITIONS: 1,
    INV_MASS: 2,
};

export const INTERACTION_OFFSET = {
    STATE: 0,
    INDEX: 1,
    TARGET_X: 2,
    TARGET_Y: 3,
    TARGET_Z: 4,
};

export type SharedBuffers = {
    positions: Float32Array;
    prevPositions: Float32Array;
    invMass: Float32Array;
    interaction: Float32Array;
    collisions: Uint8Array; // <--- NEW: 0 = Safe, 1 = Colliding
};

export function createSharedBuffers(vertexCount: number): { buffer: SharedArrayBuffer, views: SharedBuffers } {
    if (typeof SharedArrayBuffer === 'undefined') {
        throw new Error("❌ SharedArrayBuffer is not defined.");
    }

    const floatCount = vertexCount * 7;
    const interactionSize = 8;
    // Align to 4 bytes for Float32, but Uint8 can sit at the end
    const collisionSize = vertexCount; // 1 byte per vertex

    // Calculate total bytes.
    // Floats take 4 bytes. Uint8 takes 1 byte.
    // We need to ensure byte alignment if we mix types, but putting Uint8 at the end is safe.
    const floatBytes = (floatCount + interactionSize) * 4;
    const totalBytes = floatBytes + collisionSize;

    const buffer = new SharedArrayBuffer(totalBytes);
    const float32View = new Float32Array(buffer);
    const uint8View = new Uint8Array(buffer);

    const posSize = vertexCount * 3;

    // Float Views
    const positions = float32View.subarray(0, posSize);
    const prevPositions = float32View.subarray(posSize, posSize * 2);
    const invMass = float32View.subarray(posSize * 2, posSize * 2 + vertexCount);
    const interaction = float32View.subarray(floatCount, floatCount + interactionSize);

    // Uint8 View (Starts after all floats)
    // floatBytes is the byte offset.
    const collisions = uint8View.subarray(floatBytes, floatBytes + vertexCount);

    return {
        buffer,
        views: { positions, prevPositions, invMass, interaction, collisions }
    };
}

export function mapSharedBuffers(buffer: SharedArrayBuffer, vertexCount: number): SharedBuffers {
    const float32View = new Float32Array(buffer);
    const uint8View = new Uint8Array(buffer);

    const posSize = vertexCount * 3;
    const floatCount = vertexCount * 7;
    const interactionSize = 8;
    const floatBytes = (floatCount + interactionSize) * 4;

    return {
        positions: float32View.subarray(0, posSize),
        prevPositions: float32View.subarray(posSize, posSize * 2),
        invMass: float32View.subarray(posSize * 2, posSize * 2 + vertexCount),
        interaction: float32View.subarray(floatCount, floatCount + interactionSize),
        collisions: uint8View.subarray(floatBytes, floatBytes + vertexCount)
    };
}