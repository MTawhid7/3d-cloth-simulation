// src/v4/adapter/useClothWorker.ts
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createSharedBuffers, type SharedBuffers } from '../shared/SharedMemory';
import { computeSkinning, type SkinningData } from '../../v3/utils/skinning';

export function useClothWorker(
    proxyMesh: THREE.Mesh | null,
    visualMesh: THREE.Mesh | null,
    mannequinMesh: THREE.Mesh | null
) {
    const workerRef = useRef<Worker | null>(null);
    const sharedBuffersRef = useRef<SharedBuffers | null>(null);
    const skinningRef = useRef<SkinningData | null>(null);

    // One-time Initialization
    useEffect(() => {
        if (!proxyMesh || !visualMesh || !mannequinMesh) return;
        if (workerRef.current) return;

        console.log('[Adapter V4] Initializing Physics Worker...');

        // 1. Prepare Data
        const pGeo = proxyMesh.geometry;
        const vertexCount = pGeo.attributes.position.count;
        const indices = pGeo.index!.array as Int32Array;

        // 2. Setup Shared Memory
        const { buffer, views } = createSharedBuffers(vertexCount);
        sharedBuffersRef.current = views;

        // 3. Copy Initial Positions to Shared Buffer
        const initialPos = pGeo.attributes.position.array;
        views.positions.set(initialPos);
        views.prevPositions.set(initialPos);

        // 4. Initialize Pinning (Simple >1.4m height check)
        for (let i = 0; i < vertexCount; i++) {
            if (initialPos[i * 3 + 1] > 1.4) {
                views.invMass[i] = 0;
            } else {
                views.invMass[i] = 1;
            }
        }

        // 5. Prepare Mannequin Data
        const mGeo = mannequinMesh.geometry;
        const mPos = mGeo.attributes.position.array.slice(0);
        const mInd = mGeo.index ? mGeo.index.array.slice(0) : new Int32Array(0);

        // 6. Spawn Worker
        const worker = new Worker(new URL('../engine/workers/physics.worker.ts', import.meta.url), {
            type: 'module'
        });

        worker.postMessage({
            type: 'INIT',
            payload: {
                buffer, // The SharedArrayBuffer
                vertexCount,
                indices,
                mannequinPositions: mPos,
                mannequinIndices: mInd
            }
        });

        workerRef.current = worker;

        // 7. Compute Skinning
        skinningRef.current = computeSkinning(visualMesh, proxyMesh);

        return () => {
            worker.terminate();
            workerRef.current = null;
        };

    }, [proxyMesh, visualMesh, mannequinMesh]);

    // Render Loop (Reads from Shared Buffer)
    useFrame(() => {
        const views = sharedBuffersRef.current;
        const skinning = skinningRef.current;

        if (!views || !visualMesh || !skinning || !proxyMesh) return;

        // B. Skinning Update (Visual Mesh)
        const visualPos = visualMesh.geometry.attributes.position;
        const physicsPos = views.positions;
        const physicsIndex = proxyMesh.geometry.index!;
        const { indices, weights } = skinning;

        for (let i = 0; i < visualPos.count; i++) {
            const faceIdx = indices[i];
            const w1 = weights[i * 3];
            const w2 = weights[i * 3 + 1];
            const w3 = weights[i * 3 + 2];

            const idxA = physicsIndex.getX(faceIdx * 3) * 3;
            const idxB = physicsIndex.getX(faceIdx * 3 + 1) * 3;
            const idxC = physicsIndex.getX(faceIdx * 3 + 2) * 3;

            const x = physicsPos[idxA] * w1 + physicsPos[idxB] * w2 + physicsPos[idxC] * w3;
            const y = physicsPos[idxA + 1] * w1 + physicsPos[idxB + 1] * w2 + physicsPos[idxC + 1] * w3;
            const z = physicsPos[idxA + 2] * w1 + physicsPos[idxB + 2] * w2 + physicsPos[idxC + 2] * w3;

            visualPos.setXYZ(i, x, y, z);
        }

        visualPos.needsUpdate = true;
        visualMesh.geometry.computeVertexNormals();
        visualMesh.geometry.computeBoundingSphere();
    });

    return { worker: workerRef.current, buffers: sharedBuffersRef.current };
}