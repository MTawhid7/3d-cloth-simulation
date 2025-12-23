// src/v4/engine/core/XPBD_Worker.ts

import type { SharedBuffers } from '../../shared/SharedMemory';
import { PHYSICS_CONSTANTS } from '../../shared/constants';
import { CollisionSystem } from './modules/CollisionSystem';
import { ConstraintSystem } from './modules/ConstraintSystem';
import { InteractionSystem } from './modules/InteractionSystem';

export class XPBD_Worker {
    private positions!: Float32Array;
    private prevPositions!: Float32Array;
    private invMass!: Float32Array;

    private collision!: CollisionSystem;
    private constraints!: ConstraintSystem;
    private interaction!: InteractionSystem;

    // Load parameters from unified constants
    private params = {
        gravity: PHYSICS_CONSTANTS.gravity,
        substeps: PHYSICS_CONSTANTS.substeps,
        drag: PHYSICS_CONSTANTS.drag,
        friction: PHYSICS_CONSTANTS.friction,
        compliance: PHYSICS_CONSTANTS.compliance
    };

    constructor(data: SharedBuffers, indices: Int32Array) {
        this.positions = data.positions;
        this.prevPositions = data.prevPositions;
        this.invMass = data.invMass;

        this.collision = new CollisionSystem();
        this.collision.setDebugBuffer(data.collisions);

        this.constraints = new ConstraintSystem(indices, this.positions);
        this.interaction = new InteractionSystem(data.interaction);

        console.log('[XPBD_Worker] Initialized with params:', this.params);
    }

    public setCollider(positionArray: Float32Array, indexArray: Int32Array) {
        this.collision.setCollider(positionArray, indexArray);
    }

    public releaseParticle(_index: number) {
        this.interaction.release();
    }

    /**
     * Main physics update loop.
     * Runs every 16ms (60 FPS) from the worker interval.
     */
    public update(dt: number) {
        // Clamp delta time to prevent instability from lag spikes
        if (dt > 0.064) dt = 0.064; // Max 64ms (15 FPS minimum)

        const sdt = dt / this.params.substeps; // Substep delta time

        // ============================================
        // PHYSICS LOOP: The "Double Tap" Pattern
        // ============================================
        for (let substep = 0; substep < this.params.substeps; substep++) {
            // 1. PREDICT: Integrate velocity → new positions
            this.integrate(sdt);

            // 2. INTERNAL FORCES: Fabric tries to maintain structure
            //    (This can pull vertices into the body)
            this.constraints.solve(
                this.positions,
                this.invMass,
                this.params.compliance,
                sdt
            );

            // 3. EXTERNAL FORCES: Mouse spring pulls toward cursor
            //    (This can also create penetrations)
            this.interaction.solve(this.positions, this.invMass, sdt);

            // ============================================
            // 4. COLLISION PASS #1: Fix major penetrations
            // ============================================
            // This catches most issues created by constraints/interaction
            this.collision.solve(
                this.positions,
                this.prevPositions,
                this.invMass,
                this.params.friction
            );

            // ============================================
            // 5. COLLISION PASS #2: The "Safety Net"
            // ============================================
            // WHY? Even after fixing positions, if a constraint immediately
            // pulls a vertex back in during the SAME substep, we need to catch it.
            //
            // This second pass ensures collision is the FINAL authority.
            // Cost: ~30% performance hit (acceptable for stability)
            this.collision.solve(
                this.positions,
                this.prevPositions,
                this.invMass,
                this.params.friction
            );
        }
    }

    /**
     * Verlet Integration: Predict next position based on velocity.
     * Velocity is implicit: v = (current_pos - prev_pos) / dt
     */
    private integrate(dt: number) {
        const count = this.invMass.length;
        const gravity = this.params.gravity * dt * dt;
        const drag = this.params.drag;

        // Velocity limiter to prevent explosions
        const MAX_VELOCITY = 0.5; // 50cm per second
        const MAX_VELOCITY_SQ = MAX_VELOCITY * MAX_VELOCITY * dt * dt;

        for (let i = 0; i < count; i++) {
            // Skip pinned vertices (invMass = 0)
            if (this.invMass[i] === 0) continue;

            const idx = i * 3;

            // Current position
            const x = this.positions[idx];
            const y = this.positions[idx + 1];
            const z = this.positions[idx + 2];

            // Previous position (used to calculate velocity)
            const px = this.prevPositions[idx];
            const py = this.prevPositions[idx + 1];
            const pz = this.prevPositions[idx + 2];

            // Verlet velocity (implicit)
            let vx = (x - px) * drag;
            let vy = (y - py) * drag + gravity; // Add gravity to Y component
            let vz = (z - pz) * drag;

            // Clamp velocity magnitude for stability
            const vSq = vx * vx + vy * vy + vz * vz;
            if (vSq > MAX_VELOCITY_SQ) {
                const scale = Math.sqrt(MAX_VELOCITY_SQ / vSq);
                vx *= scale;
                vy *= scale;
                vz *= scale;
            }

            // Store current position as previous (for next frame's velocity)
            this.prevPositions[idx] = x;
            this.prevPositions[idx + 1] = y;
            this.prevPositions[idx + 2] = z;

            // Predict next position
            this.positions[idx] = x + vx;
            this.positions[idx + 1] = y + vy;
            this.positions[idx + 2] = z + vz;
        }
    }

    // ====================================
    // DIAGNOSTIC UTILITIES
    // ====================================

    /**
     * Returns collision statistics for debugging.
     * Call this from the main thread periodically.
     */
    public getDiagnostics() {
        const count = this.invMass.length;
        let penetratingCount = 0;
        let maxPenetration = 0;
        let avgPenetration = 0;

        for (let i = 0; i < count; i++) {
            if (this.invMass[i] === 0) continue; // Skip pinned

            const idx = i * 3;
            const x = this.positions[idx];
            const y = this.positions[idx + 1];
            const z = this.positions[idx + 2];

            // Ask collision system: "If this vertex were here, where should it be?"
            const result = this.collision.resolvePoint(x, y, z);

            const dx = result.x - x;
            const dy = result.y - y;
            const dz = result.z - z;
            const displacement = Math.sqrt(dx * dx + dy * dy + dz * dz);

            // If collision system moved it, it was penetrating
            if (displacement > 0.001) { // 1mm threshold
                penetratingCount++;
                avgPenetration += displacement;
                maxPenetration = Math.max(maxPenetration, displacement);
            }
        }

        if (penetratingCount > 0) {
            avgPenetration /= penetratingCount;
        }

        return {
            penetratingVertices: penetratingCount,
            totalVertices: count,
            penetrationRate: ((penetratingCount / count) * 100).toFixed(2) + '%',
            avgPenetrationDepth: (avgPenetration * 1000).toFixed(2) + 'mm',
            maxPenetrationDepth: (maxPenetration * 1000).toFixed(2) + 'mm',
            substeps: this.params.substeps,
            skinOffset: PHYSICS_CONSTANTS.SKIN_OFFSET * 1000 + 'mm'
        };
    }
}