// src/v3/engine/XPBD.ts
import * as THREE from 'three';
import { MannequinCollider } from './MannequinCollider';
import { PHYSICS_CONSTANTS } from '../shared/constants';

export class XPBD {
    // Add '!' to tell TypeScript these are initialized in initPhysics()
    public positions!: Float32Array;
    private prevPositions!: Float32Array;
    private invMass!: Float32Array;

    private constraints!: Int32Array;
    private restLengths!: Float32Array;

    public collider: MannequinCollider;
    private tempVec = new THREE.Vector3();

    constructor(mesh: THREE.Mesh) {
        this.collider = new MannequinCollider();
        this.initPhysics(mesh);
    }

    private initPhysics(mesh: THREE.Mesh) {
        const geo = mesh.geometry;
        const posAttr = geo.attributes.position;
        const count = posAttr.count;

        this.positions = new Float32Array(count * 3);
        this.prevPositions = new Float32Array(count * 3);
        this.invMass = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;

            this.prevPositions[i * 3] = x;
            this.prevPositions[i * 3 + 1] = y;
            this.prevPositions[i * 3 + 2] = z;

            if (y > PHYSICS_CONSTANTS.pinHeight) {
                this.invMass[i] = 0;
            } else {
                this.invMass[i] = 1.0;
            }
        }

        this.createConstraints(geo);
    }

    private createConstraints(geo: THREE.BufferGeometry) {
        const index = geo.index;
        if (!index) throw new Error("Proxy mesh must be indexed!");

        const edges = new Set<string>();
        const constraintList: number[] = [];
        const lengthList: number[] = [];

        const addEdge = (a: number, b: number) => {
            const key = a < b ? `${a}_${b}` : `${b}_${a}`;
            if (edges.has(key)) return;
            edges.add(key);

            constraintList.push(a, b);

            const idxA = a * 3;
            const idxB = b * 3;
            const dx = this.positions[idxA] - this.positions[idxB];
            const dy = this.positions[idxA + 1] - this.positions[idxB + 1];
            const dz = this.positions[idxA + 2] - this.positions[idxB + 2];
            lengthList.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
        };

        for (let i = 0; i < index.count; i += 3) {
            addEdge(index.getX(i), index.getX(i + 1));
            addEdge(index.getX(i + 1), index.getX(i + 2));
            addEdge(index.getX(i + 2), index.getX(i));
        }

        this.constraints = new Int32Array(constraintList);
        this.restLengths = new Float32Array(lengthList);
        console.log(`[Physics] Created ${lengthList.length} constraints.`);
    }

    public update(dt: number) {
        const sdt = dt / PHYSICS_CONSTANTS.substeps;

        for (let step = 0; step < PHYSICS_CONSTANTS.substeps; step++) {
            this.integrate(sdt);
            this.solveConstraints(sdt);
            this.solveCollisions();
        }
    }

    private integrate(dt: number) {
        const count = this.invMass.length;
        const gravity = PHYSICS_CONSTANTS.gravity * dt * dt;
        const drag = PHYSICS_CONSTANTS.drag;

        for (let i = 0; i < count; i++) {
            if (this.invMass[i] === 0) continue;

            const idx = i * 3;
            const x = this.positions[idx];
            const y = this.positions[idx + 1];
            const z = this.positions[idx + 2];
            const px = this.prevPositions[idx];
            const py = this.prevPositions[idx + 1];
            const pz = this.prevPositions[idx + 2];

            const vx = (x - px) * drag;
            const vy = (y - py) * drag;
            const vz = (z - pz) * drag;

            this.prevPositions[idx] = x;
            this.prevPositions[idx + 1] = y;
            this.prevPositions[idx + 2] = z;

            this.positions[idx] = x + vx;
            this.positions[idx + 1] = y + vy + gravity;
            this.positions[idx + 2] = z + vz;
        }
    }

    private solveConstraints(dt: number) {
        const count = this.restLengths.length;
        const alpha = PHYSICS_CONSTANTS.compliance / (dt * dt);

        for (let i = 0; i < count; i++) {
            const a = this.constraints[i * 2];
            const b = this.constraints[i * 2 + 1];
            const idxA = a * 3;
            const idxB = b * 3;

            const wA = this.invMass[a];
            const wB = this.invMass[b];
            const wSum = wA + wB;
            if (wSum === 0) continue;

            const dx = this.positions[idxA] - this.positions[idxB];
            const dy = this.positions[idxA + 1] - this.positions[idxB + 1];
            const dz = this.positions[idxA + 2] - this.positions[idxB + 2];

            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            const rest = this.restLengths[i];
            const C = dist - rest;
            const lambda = -C / (wSum + alpha);

            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;

            if (wA > 0) {
                this.positions[idxA] += nx * lambda * wA;
                this.positions[idxA + 1] += ny * lambda * wA;
                this.positions[idxA + 2] += nz * lambda * wA;
            }
            if (wB > 0) {
                this.positions[idxB] -= nx * lambda * wB;
                this.positions[idxB + 1] -= ny * lambda * wB;
                this.positions[idxB + 2] -= nz * lambda * wB;
            }
        }
    }

    private solveCollisions() {
        const count = this.invMass.length;
        for (let i = 0; i < count; i++) {
            if (this.invMass[i] === 0) continue;
            const idx = i * 3;
            this.tempVec.set(this.positions[idx], this.positions[idx + 1], this.positions[idx + 2]);

            if (this.collider.resolveCollision(this.tempVec)) {
                this.positions[idx] = this.tempVec.x;
                this.positions[idx + 1] = this.tempVec.y;
                this.positions[idx + 2] = this.tempVec.z;

                // Simple Friction
                const px = this.prevPositions[idx];
                const py = this.prevPositions[idx + 1];
                const pz = this.prevPositions[idx + 2];

                this.prevPositions[idx] = px + (this.positions[idx] - px) * (1 - PHYSICS_CONSTANTS.friction);
                this.prevPositions[idx + 1] = py + (this.positions[idx + 1] - py) * (1 - PHYSICS_CONSTANTS.friction);
                this.prevPositions[idx + 2] = pz + (this.positions[idx + 2] - pz) * (1 - PHYSICS_CONSTANTS.friction);
            }
        }
    }

    public sync(mesh: THREE.Mesh) {
        const posAttr = mesh.geometry.attributes.position;
        for (let i = 0; i < this.invMass.length; i++) {
            posAttr.setXYZ(i, this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
        }
        posAttr.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
    }
}