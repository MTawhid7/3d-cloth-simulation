// src/v4/engine/core/modules/InteractionSystem.ts

import { INTERACTION_OFFSET } from '../../../shared/SharedMemory';
import { PHYSICS_CONSTANTS } from '../../../shared/constants';

export class InteractionSystem {
    private interaction: Float32Array;

    // Area Grab Data
    private grabbedIndices: number[] = [];
    private grabbedOffsets: Float32Array | null = null;
    private isGrabbing: boolean = false;

    // ============================================
    // GRAB RADIUS: Controls how much cloth moves when you drag
    // ============================================
    private readonly GRAB_RADIUS = 0.07; // 7cm - Good balance between control and realism
    private readonly GRAB_RADIUS_SQ = this.GRAB_RADIUS * this.GRAB_RADIUS;

    constructor(interactionBuffer: Float32Array) {
        this.interaction = interactionBuffer;
    }

    /**
     * Applies mouse spring constraint to grabbed vertices.
     * This runs INSIDE the substep loop, competing with other constraints.
     */
    public solve(positions: Float32Array, invMass: Float32Array, dt: number) {
        const state = this.interaction[INTERACTION_OFFSET.STATE];
        const centerIndex = this.interaction[INTERACTION_OFFSET.INDEX];

        const tx = this.interaction[INTERACTION_OFFSET.TARGET_X];
        const ty = this.interaction[INTERACTION_OFFSET.TARGET_Y];
        const tz = this.interaction[INTERACTION_OFFSET.TARGET_Z];

        // ============================================
        // 1. INITIALIZE GRAB (First Frame of Drag)
        // ============================================
        if (state === 1 && !this.isGrabbing && centerIndex >= 0) {
            this.isGrabbing = true;
            this.grabbedIndices = [];

            const cx = positions[centerIndex * 3];
            const cy = positions[centerIndex * 3 + 1];
            const cz = positions[centerIndex * 3 + 2];

            const count = invMass.length;
            const indices = [];
            const offsets = [];

            // Find all vertices within GRAB_RADIUS of the clicked point
            for (let i = 0; i < count; i++) {
                const idx = i * 3;
                const dx = positions[idx] - cx;
                const dy = positions[idx + 1] - cy;
                const dz = positions[idx + 2] - cz;

                if (dx * dx + dy * dy + dz * dz < this.GRAB_RADIUS_SQ) {
                    indices.push(i);
                    // Store offset to maintain fold shape during drag
                    offsets.push(dx, dy, dz);
                }
            }

            this.grabbedIndices = indices;
            this.grabbedOffsets = new Float32Array(offsets);

            console.log(`[Interaction] Grabbed ${indices.length} vertices`);
        }

        // ============================================
        // 2. APPLY MOUSE SPRING (During Drag)
        // ============================================
        if (state === 1 && this.isGrabbing) {
            // Spring stiffness (Lower compliance = Stiffer spring)
            // 0.0001 = Very stiff (cloth follows mouse closely)
            // 0.001  = Softer (cloth lags behind mouse)
            const compliance = 0.0001;
            const alpha = compliance / (dt * dt);

            for (let k = 0; k < this.grabbedIndices.length; k++) {
                const i = this.grabbedIndices[k];
                const w = invMass[i];

                // Skip pinned vertices (they can't move)
                if (w === 0) continue;

                const idx = i * 3;

                // Calculate target position (mouse pos + original offset)
                const ox = this.grabbedOffsets![k * 3];
                const oy = this.grabbedOffsets![k * 3 + 1];
                const oz = this.grabbedOffsets![k * 3 + 2];

                const targetX = tx + ox;
                const targetY = ty + oy;
                const targetZ = tz + oz;

                // Current position
                const x = positions[idx];
                const y = positions[idx + 1];
                const z = positions[idx + 2];

                // XPBD Spring Constraint:
                // Correction = (Target - Current) * (w / (w + alpha))
                // This creates a "soft" pull toward the mouse
                const factor = w / (w + alpha);

                positions[idx] += (targetX - x) * factor;
                positions[idx + 1] += (targetY - y) * factor;
                positions[idx + 2] += (targetZ - z) * factor;
            }
        }

        // ============================================
        // 3. RELEASE (Mouse Button Up)
        // ============================================
        if (state === 0 && this.isGrabbing) {
            this.isGrabbing = false;
            this.grabbedIndices = [];
            this.grabbedOffsets = null;
            console.log('[Interaction] Released grab');
        }
    }

    /**
     * Called from main thread when user releases mouse.
     * Ensures clean state reset.
     */
    public release() {
        this.isGrabbing = false;
        this.grabbedIndices = [];
        this.grabbedOffsets = null;
    }
}