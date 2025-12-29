// src/v3/engine/utils/Topology.ts
import * as THREE from 'three';

export class Topology {
    public static findBoundaryLoops(geo: THREE.BufferGeometry): number[][] {
        const index = geo.index;
        if (!index) return [];

        // 1. Count Edge Occurrences
        // Key: "min_max", Value: count
        const edgeCounts = new Map<string, number>();

        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i);
            const b = index.getX(i + 1);
            const c = index.getX(i + 2);

            const edges = [
                a < b ? `${a}_${b}` : `${b}_${a}`,
                b < c ? `${b}_${c}` : `${c}_${b}`,
                c < a ? `${c}_${a}` : `${a}_${c}`
            ];

            edges.forEach(key => {
                edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
            });
        }

        // 2. Filter for Boundary Edges (Count === 1)
        const boundaryEdges: [number, number][] = [];
        edgeCounts.forEach((count, key) => {
            if (count === 1) {
                const [a, b] = key.split('_').map(Number);
                boundaryEdges.push([a, b]);
            }
        });

        // 3. Connect Edges into Loops (Naive approach for simple garments)
        // For this specific problem, we just need the vertices, not the ordered loop.
        // We will group them by Y-height to distinguish Neck vs Waist.

        return []; // Not strictly needed if we use the simpler method below
    }

    public static getNeckIndices(geo: THREE.BufferGeometry, positions: Float32Array): Set<number> {
        const index = geo.index;
        if (!index) return new Set();

        // 1. Find Boundary Edges
        const edgeCounts = new Map<string, number>();
        for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i);
            const b = index.getX(i + 1);
            const c = index.getX(i + 2);
            const edges = [
                a < b ? `${a}_${b}` : `${b}_${a}`,
                b < c ? `${b}_${c}` : `${c}_${b}`,
                c < a ? `${c}_${a}` : `${a}_${c}`
            ];
            edges.forEach(e => edgeCounts.set(e, (edgeCounts.get(e) || 0) + 1));
        }

        // 2. Collect Boundary Vertices
        const boundaryVerts = new Set<number>();
        edgeCounts.forEach((count, key) => {
            if (count === 1) {
                const [a, b] = key.split('_').map(Number);
                boundaryVerts.add(a);
                boundaryVerts.add(b);
            }
        });

        // 3. Separate into Clusters based on Y-Height
        // We assume the Neck is the "Highest" cluster of boundary vertices.
        const clusters: { id: number, y: number }[] = [];

        boundaryVerts.forEach(idx => {
            clusters.push({ id: idx, y: positions[idx * 3 + 1] });
        });

        // Sort by Height Descending
        clusters.sort((a, b) => b.y - a.y);

        // Take the top 20% of boundary vertices (The Neck)
        // Or better: Take the first vertex, and all other boundary vertices within 10cm vertical distance
        if (clusters.length === 0) return new Set();

        const maxY = clusters[0].y;
        const neckSet = new Set<number>();

        // Threshold: Vertices within 15cm of the highest point
        for (const v of clusters) {
            if (maxY - v.y < 0.15) {
                neckSet.add(v.id);
            }
        }

        console.log(`[Topology] Detected Neck Ring: ${neckSet.size} vertices`);
        return neckSet;
    }
}