import { XPBD_Worker } from '../core/XPBD_Worker';
import { mapSharedBuffers } from '../../shared/SharedMemory';

let solver: XPBD_Worker | null = null;
let intervalId: any = null;

self.onmessage = (e: MessageEvent) => {
    const { type, payload } = e.data;

    if (type === 'INIT') {
        const { buffer, vertexCount, indices, mannequinPositions, mannequinIndices } = payload;

        console.log('[Worker] Received INIT signal.');
        const buffers = mapSharedBuffers(buffer, vertexCount);

        solver = new XPBD_Worker(buffers, indices);
        solver.setCollider(mannequinPositions, mannequinIndices);

        // Start Loop
        if (intervalId) clearInterval(intervalId);

        // 60 FPS Physics Loop
        // Note: In production, we might want to drift-correct this, but setInterval is fine for V4.1
        intervalId = setInterval(() => {
            if (solver) {
                // Fixed Time Step
                solver.update(0.016);
            }
        }, 16);
    }

    if (type === 'UPDATE_PARAMS') {
        // TODO: Handle parameter updates (compliance, drag, etc)
    }
};

export { };