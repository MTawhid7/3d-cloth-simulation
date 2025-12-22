import * as THREE from 'three';
import { PhysicsData } from './PhysicsData';
import { DistanceConstraint } from '../constraints/DistanceConstraint';
import { BendingConstraint } from '../constraints/BendingConstraint';
import { MannequinCollider } from '../MannequinCollider';
import { PHYSICS_CONSTANTS } from '../../shared/constants';

export class Solver {
    public data: PhysicsData;
    private distanceConstraints: DistanceConstraint;
    private bendingConstraints: BendingConstraint;
    public collider: MannequinCollider;
    private tempVec = new THREE.Vector3();

    constructor(clothMesh: THREE.Mesh, collisionMesh: THREE.Mesh) {
        this.data = new PhysicsData(clothMesh);
        this.distanceConstraints = new DistanceConstraint(clothMesh.geometry, this.data);
        this.bendingConstraints = new BendingConstraint(clothMesh.geometry, this.data);

        // Initialize Collider with the Mannequin Mesh
        this.collider = new MannequinCollider(collisionMesh);
    }

    public update(dt: number) {
        const sdt = dt / PHYSICS_CONSTANTS.substeps;

        for (let step = 0; step < PHYSICS_CONSTANTS.substeps; step++) {
            this.integrate(sdt);

            // 1. Structural
            const structuralAlpha = PHYSICS_CONSTANTS.compliance / (sdt * sdt);
            this.distanceConstraints.solve(this.data, structuralAlpha);

            // 2. Bending (Softer)
            const bendingAlpha = (PHYSICS_CONSTANTS.compliance * PHYSICS_CONSTANTS.bendingMultiplier) / (sdt * sdt);
            this.bendingConstraints.solve(this.data, bendingAlpha);

            // 3. Collision
            this.solveCollisions();
        }
    }

    private integrate(dt: number) {
        const count = this.data.count;
        const gravity = PHYSICS_CONSTANTS.gravity * dt * dt;
        const drag = PHYSICS_CONSTANTS.drag;

        const pos = this.data.positions;
        const prev = this.data.prevPositions;
        const invMass = this.data.invMass;

        for (let i = 0; i < count; i++) {
            if (invMass[i] === 0) continue;

            const idx = i * 3;
            let x = pos[idx];
            let y = pos[idx + 1];
            let z = pos[idx + 2];

            const px = prev[idx];
            const py = prev[idx + 1];
            const pz = prev[idx + 2];

            const vx = (x - px) * drag;
            const vy = (y - py) * drag;
            const vz = (z - pz) * drag;

            prev[idx] = x;
            prev[idx + 1] = y;
            prev[idx + 2] = z;

            x += vx;
            y += vy + gravity;
            z += vz;

            // --- SAFETY CLAMP (Prevent Explosion) ---
            if (Math.abs(x) > 10 || Math.abs(y) > 10 || Math.abs(z) > 10 || isNaN(x)) {
                // Reset to a safe spot if it flies away
                x = 0; y = 1.35; z = 0.2;
                prev[idx] = x; prev[idx + 1] = y; prev[idx + 2] = z;
            }
            // ----------------------------------------

            pos[idx] = x;
            pos[idx + 1] = y;
            pos[idx + 2] = z;
        }
    }

    private solveCollisions() {
        const count = this.data.count;
        const pos = this.data.positions;
        const prev = this.data.prevPositions;
        const invMass = this.data.invMass;

        for (let i = 0; i < count; i++) {
            if (invMass[i] === 0) continue;
            const idx = i * 3;

            this.tempVec.set(pos[idx], pos[idx + 1], pos[idx + 2]);

            if (this.collider.resolveCollision(this.tempVec)) {
                pos[idx] = this.tempVec.x;
                pos[idx + 1] = this.tempVec.y;
                pos[idx + 2] = this.tempVec.z;

                // Friction: Dampen velocity on contact
                const f = 1 - PHYSICS_CONSTANTS.friction;
                prev[idx] = prev[idx] + (pos[idx] - prev[idx]) * f;
                prev[idx + 1] = prev[idx + 1] + (pos[idx + 1] - prev[idx + 1]) * f;
                prev[idx + 2] = prev[idx + 2] + (pos[idx + 2] - prev[idx + 2]) * f;
            }
        }
    }
}