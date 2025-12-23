// src/v4/engine/workers/physics.worker.ts
// UPDATED VERSION with diagnostic support

import { XPBD_Worker } from '../core/XPBD_Worker';
import { mapSharedBuffers } from '../../shared/SharedMemory';

let solver: XPBD_Worker | null = null;
let intervalId: any = null;

self.onmessage = (e: MessageEvent) => {
    const { type, payload, index } = e.data;

    if (type === 'INIT') {
        const { buffer, vertexCount, indices, mannequinPositions, mannequinIndices } = payload;
        const buffers = mapSharedBuffers(buffer, vertexCount);

        solver = new XPBD_Worker(buffers, indices);
        solver.setCollider(mannequinPositions, mannequinIndices);

        console.log('[Worker] Physics engine initialized');

        // Start physics loop
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(() => {
            if (solver) solver.update(0.016); // 60 FPS target
        }, 16);

        // Send confirmation back to main thread
        self.postMessage({ type: 'READY' });
    }

    if (type === 'RELEASE' && solver) {
        solver.releaseParticle(index);
    }

    // NEW: Diagnostic request handler
    if (type === 'GET_DIAGNOSTICS' && solver) {
        const diagnostics = solver.getDiagnostics();
        self.postMessage({
            type: 'DIAGNOSTICS_RESULT',
            data: diagnostics
        });
    }
};

export { };

// ============================================
// HOW TO USE FROM MAIN THREAD:
// ============================================

/*
// In your React component (e.g., VirtualTryOnV4.tsx):

import { useEffect } from 'react';

export const VirtualTryOnV4 = () => {
    const { worker } = useClothWorker(...);

    useEffect(() => {
        if (!worker) return;

        // Listen for diagnostic results
        const handleMessage = (e: MessageEvent) => {
            if (e.data.type === 'DIAGNOSTICS_RESULT') {
                console.log('🔍 Physics Diagnostics:', e.data.data);

                // Example output:
                // {
                //   penetratingVertices: 5,
                //   totalVertices: 1200,
                //   penetrationRate: "0.42%",
                //   avgPenetrationDepth: "0.83mm",
                //   maxPenetrationDepth: "2.15mm",
                //   substeps: 20,
                //   skinOffset: "15mm"
                // }
            }
        };

        worker.addEventListener('message', handleMessage);

        // Request diagnostics every 2 seconds
        const diagnosticInterval = setInterval(() => {
            worker.postMessage({ type: 'GET_DIAGNOSTICS' });
        }, 2000);

        return () => {
            worker.removeEventListener('message', handleMessage);
            clearInterval(diagnosticInterval);
        };
    }, [worker]);

    // ... rest of component
};
*/

// ============================================
// DEBUGGING WORKFLOW:
// ============================================

/*
1. Enable diagnostics in development mode
2. Watch console for penetration rates
3. Acceptable ranges:
   - At rest: <0.5% penetration
   - During light drag: <3% penetration
   - During heavy drag: <10% penetration
   - After release: Should drop to <0.5% within 2 seconds

4. If rates exceed these thresholds:
   - Check SKIN_OFFSET value
   - Verify substeps count
   - Consider increasing compliance (softer fabric)
   - As last resort: Add third collision pass

5. Performance impact of diagnostics:
   - Negligible (~0.1ms per call)
   - Safe to run every 2 seconds in production
   - Disable in final build if needed
*/