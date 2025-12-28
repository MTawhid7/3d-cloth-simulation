// src/v3/engine/constraints/DistanceConstraint.ts
import * as THREE from 'three';
import { PhysicsData } from '../core/PhysicsData';
import { PHYSICS_CONSTANTS } from '../../shared/constants';

export class DistanceConstraint {
    // Initialize with empty defaults to satisfy TypeScript strict mode
    private constraints: Int32Array = new Int32Array(0);
    private restLengths: Float32Array = new Float32Array(0);
    private count: number = 0;

    constructor(geo: THREE.BufferGeometry, data: PhysicsData) {
        const index = geo.index;
        if (!index) throw new Error("Mesh must be indexed");

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
            const dx = data.positions[idxA] - data.positions[idxB];
            const dy = data.positions[idxA + 1] - data.positions[idxB + 1];
            const dz = data.positions[idxA + 2] - data.positions[idxB + 2];
            lengthList.push(Math.sqrt(dx * dx + dy * dy + dz * dz));
        };

        for (let i = 0; i < index.count; i += 3) {
            addEdge(index.getX(i), index.getX(i + 1));
            addEdge(index.getX(i + 1), index.getX(i + 2));
            addEdge(index.getX(i + 2), index.getX(i));
        }

        this.constraints = new Int32Array(constraintList);
        this.restLengths = new Float32Array(lengthList);
        this.count = lengthList.length;
    }

    public solve(data: PhysicsData, dt: number) {
        const alpha = PHYSICS_CONSTANTS.compliance / (dt * dt);
        const pos = data.positions;
        const invMass = data.invMass;

        for (let i = 0; i < this.count; i++) {
            const idA = this.constraints[i * 2];
            const idB = this.constraints[i * 2 + 1];

            const wA = invMass[idA];
            const wB = invMass[idB];
            const wSum = wA + wB;
            if (wSum === 0) continue;

            const idxA = idA * 3;
            const idxB = idB * 3;

            const dx = pos[idxA] - pos[idxB];
            const dy = pos[idxA + 1] - pos[idxB + 1];
            const dz = pos[idxA + 2] - pos[idxB + 2];

            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (dist < 0.000001) continue;

            const rest = this.restLengths[i];
            const C = dist - rest;

            const lambda = -C / (wSum + alpha);

            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;

            if (wA > 0) {
                pos[idxA] += nx * lambda * wA;
                pos[idxA + 1] += ny * lambda * wA;
                pos[idxA + 2] += nz * lambda * wA;
            }
            if (wB > 0) {
                pos[idxB] -= nx * lambda * wB;
                pos[idxB + 1] -= ny * lambda * wB;
                pos[idxB + 2] -= nz * lambda * wB;
            }
        }
    }
}