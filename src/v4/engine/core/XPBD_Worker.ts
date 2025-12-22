import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import type { SharedBuffers } from '../../shared/SharedMemory';

// Enable BVH raycasting in the worker
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

export class XPBD_Worker {
    private positions: Float32Array;
    private prevPositions: Float32Array;
    private invMass: Float32Array;

    private constraints: Int32Array;
    private restLengths: Float32Array;
    private constraintCount: number = 0;

    private colliderBVH: MeshBVH | null = null;
    private tempVec = new THREE.Vector3();
    private tempTarget = { point: new THREE.Vector3(), distance: 0, faceIndex: -1 };

    // Physics Constants (Hardcoded for now, pass via init later)
    private params = {
        gravity: -9.81,
        substeps: 10,
        drag: 0.97,
        friction: 0.5,
        compliance: 0.00001
    };

    constructor(data: SharedBuffers, indices: Int32Array) {
        this.positions = data.positions;
        this.prevPositions = data.prevPositions;
        this.invMass = data.invMass;

        // Initialize Constraints immediately
        const { constraints, restLengths } = this.initConstraints(indices, this.positions);
        this.constraints = constraints;
        this.restLengths = restLengths;
        this.constraintCount = restLengths.length;

        console.log(`[Worker] XPBD initialized with ${this.constraintCount} constraints.`);
    }

    public setCollider(positionArray: Float32Array, indexArray: Int32Array) {
        // Reconstruct the Mannequin geometry inside the worker
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
        geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));

        // Build BVH
        this.colliderBVH = new MeshBVH(geometry);
        console.log('[Worker] Collider BVH generated.');
    }

    public update(dt: number) {
        if (dt > 0.064) dt = 0.064; // Cap max timestep
        const sdt = dt / this.params.substeps;

        for (let i = 0; i < this.params.substeps; i++) {
            this.integrate(sdt);
            this.solveConstraints(sdt);
            this.solveCollisions();
        }
    }

    private integrate(dt: number) {
        const count = this.invMass.length;
        const gravity = this.params.gravity * dt * dt;

        for (let i = 0; i < count; i++) {
            if (this.invMass[i] === 0) continue; // Pinned

            const idx = i * 3;
            const x = this.positions[idx];
            const y = this.positions[idx + 1];
            const z = this.positions[idx + 2];

            const px = this.prevPositions[idx];
            const py = this.prevPositions[idx + 1];
            const pz = this.prevPositions[idx + 2];

            // Verlet Integration
            this.prevPositions[idx] = x;
            this.prevPositions[idx + 1] = y;
            this.prevPositions[idx + 2] = z;

            this.positions[idx] = x + (x - px) * this.params.drag;
            this.positions[idx + 1] = y + (y - py) * this.params.drag + gravity;
            this.positions[idx + 2] = z + (z - pz) * this.params.drag;
        }
    }

    private solveConstraints(dt: number) {
        const alpha = this.params.compliance / (dt * dt);

        for (let i = 0; i < this.constraintCount; i++) {
            const i2 = i * 2;
            const a = this.constraints[i2];
            const b = this.constraints[i2 + 1];

            const wA = this.invMass[a];
            const wB = this.invMass[b];
            const wSum = wA + wB;
            if (wSum === 0) continue;

            const idxA = a * 3;
            const idxB = b * 3;

            const dx = this.positions[idxA] - this.positions[idxB];
            const dy = this.positions[idxA + 1] - this.positions[idxB + 1];
            const dz = this.positions[idxA + 2] - this.positions[idxB + 2];

            const distSq = dx * dx + dy * dy + dz * dz;
            const dist = Math.sqrt(distSq);

            // Avoid division by zero
            if (dist < 1e-6) continue;

            const rest = this.restLengths[i];
            const correction = (dist - rest) / (wSum + alpha);

            const cx = (dx / dist) * correction;
            const cy = (dy / dist) * correction;
            const cz = (dz / dist) * correction;

            if (wA > 0) {
                this.positions[idxA] -= cx * wA;
                this.positions[idxA + 1] -= cy * wA;
                this.positions[idxA + 2] -= cz * wA;
            }
            if (wB > 0) {
                this.positions[idxB] += cx * wB;
                this.positions[idxB + 1] += cy * wB;
                this.positions[idxB + 2] += cz * wB;
            }
        }
    }

    private solveCollisions() {
        if (!this.colliderBVH) return;

        const count = this.invMass.length;
        // Inverse matrix not needed if we assume Mannequin is at 0,0,0 and static
        // If Mannequin moves, we must pass the matrix to the worker.
        // For Stage 4.1, assume static mannequin at origin.

        for (let i = 0; i < count; i++) {
            if (this.invMass[i] === 0) continue;

            const idx = i * 3;
            this.tempVec.set(this.positions[idx], this.positions[idx + 1], this.positions[idx + 2]);

            // Simple sphere check against BVH
            const hit = this.colliderBVH.closestPointToPoint(this.tempVec, this.tempTarget);

            if (hit && hit.distance < 0.015) { // 1.5cm thickness buffer
                // Repulse
                const normal = this.tempVec.sub(hit.point).normalize();
                const targetPos = hit.point.add(normal.multiplyScalar(0.015));

                this.positions[idx] = targetPos.x;
                this.positions[idx + 1] = targetPos.y;
                this.positions[idx + 2] = targetPos.z;

                // Friction
                const f = 1 - this.params.friction;
                this.prevPositions[idx] = this.positions[idx] - (this.positions[idx] - this.prevPositions[idx]) * f;
                this.prevPositions[idx + 1] = this.positions[idx + 1] - (this.positions[idx + 1] - this.prevPositions[idx + 1]) * f;
                this.prevPositions[idx + 2] = this.positions[idx + 2] - (this.positions[idx + 2] - this.prevPositions[idx + 2]) * f;
            }
        }
    }

    // --- Helper: Build constraints from indices (Simple Distance only for now) ---
    private initConstraints(indices: Int32Array, pos: Float32Array) {
        const constraints: number[] = [];
        const rests: number[] = [];
        const edges = new Set<string>();

        const addEdge = (a: number, b: number) => {
            const key = a < b ? `${a}_${b}` : `${b}_${a}`;
            if (edges.has(key)) return;
            edges.add(key);

            constraints.push(a, b);

            const dx = pos[a * 3] - pos[b * 3];
            const dy = pos[a * 3 + 1] - pos[b * 3 + 1];
            const dz = pos[a * 3 + 2] - pos[b * 3 + 2];
            rests.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
        };

        for (let i = 0; i < indices.length; i += 3) {
            addEdge(indices[i], indices[i + 1]);
            addEdge(indices[i + 1], indices[i + 2]);
            addEdge(indices[i + 2], indices[i]);
        }

        return {
            constraints: new Int32Array(constraints),
            restLengths: new Float32Array(rests)
        };
    }
}