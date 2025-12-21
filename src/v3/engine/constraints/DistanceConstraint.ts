import * as THREE from 'three';
import { PhysicsData } from '../core/PhysicsData';

export class DistanceConstraint {
    private constraints!: Int32Array; // [idA, idB, idA, idB...]
    private restLengths!: Float32Array;
    private count!: number;

    constructor(geo: THREE.BufferGeometry, data: PhysicsData) {
        this.initConstraints(geo, data);
    }

    private initConstraints(geo: THREE.BufferGeometry, data: PhysicsData) {
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

            // Calculate Rest Length
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
        console.log(`[Physics] Created ${this.count} Distance Constraints`);
    }

    public solve(data: PhysicsData, alpha: number) {
        const pos = data.positions;
        const invMass = data.invMass;

        for (let i = 0; i < this.count; i++) {
            const idxA = this.constraints[i * 2] * 3;
            const idxB = this.constraints[i * 2 + 1] * 3;

            const wA = invMass[this.constraints[i * 2]];
            const wB = invMass[this.constraints[i * 2 + 1]];
            const wSum = wA + wB;
            if (wSum === 0) continue;

            const dx = pos[idxA] - pos[idxB];
            const dy = pos[idxA + 1] - pos[idxB + 1];
            const dz = pos[idxA + 2] - pos[idxB + 2];

            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
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