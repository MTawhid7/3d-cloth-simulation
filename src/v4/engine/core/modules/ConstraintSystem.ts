export class ConstraintSystem {
    private constraints: Int32Array; // [p1, p2, p1, p2...]
    private restLengths: Float32Array;
    private count: number = 0;

    constructor(indices: Int32Array, positions: Float32Array) {
        const { constraints, restLengths } = this.buildTopology(indices, positions);
        this.constraints = constraints;
        this.restLengths = restLengths;
        this.count = restLengths.length;
        console.log(`[Worker] Constraint System: ${this.count} constraints created`);
    }

    private buildTopology(indices: Int32Array, pos: Float32Array) {
        const constraintList: number[] = [];
        const rests: number[] = [];
        const edges = new Set<string>();

        const addEdge = (a: number, b: number) => {
            // Unique key to prevent duplicate edges
            const key = a < b ? `${a}_${b}` : `${b}_${a}`;
            if (edges.has(key)) return;
            edges.add(key);

            constraintList.push(a, b);

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
            constraints: new Int32Array(constraintList),
            restLengths: new Float32Array(rests)
        };
    }

    public solve(positions: Float32Array, invMass: Float32Array, compliance: number, dt: number) {
        const alpha = compliance / (dt * dt);

        for (let i = 0; i < this.count; i++) {
            const i2 = i * 2;
            const a = this.constraints[i2];
            const b = this.constraints[i2 + 1];

            const wA = invMass[a];
            const wB = invMass[b];
            const wSum = wA + wB;
            if (wSum === 0) continue;

            const idxA = a * 3;
            const idxB = b * 3;

            const dx = positions[idxA] - positions[idxB];
            const dy = positions[idxA + 1] - positions[idxB + 1];
            const dz = positions[idxA + 2] - positions[idxB + 2];

            const distSq = dx * dx + dy * dy + dz * dz;
            // Fast check to avoid sqrt if possible, though needed for correction
            if (distSq < 1e-12) continue;

            const dist = Math.sqrt(distSq);
            const rest = this.restLengths[i];

            // XPBD Correction Formula
            const correction = (dist - rest) / (wSum + alpha);

            const cx = (dx / dist) * correction;
            const cy = (dy / dist) * correction;
            const cz = (dz / dist) * correction;

            if (wA > 0) {
                positions[idxA] -= cx * wA;
                positions[idxA + 1] -= cy * wA;
                positions[idxA + 2] -= cz * wA;
            }
            if (wB > 0) {
                positions[idxB] += cx * wB;
                positions[idxB + 1] += cy * wB;
                positions[idxB + 2] += cz * wB;
            }
        }
    }
}