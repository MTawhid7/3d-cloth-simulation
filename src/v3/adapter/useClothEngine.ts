// src/v3/adapter/useClothEngine.ts
import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Solver } from '../engine/core/Solver';
import { computeSkinning, type SkinningData } from '../utils/skinning';
import { PHYSICS_CONSTANTS } from '../shared/constants';

export function useClothEngine(
    proxyMesh: THREE.Mesh | null,
    visualMesh: THREE.Mesh | null,
    mannequinMesh: THREE.Mesh | null
) {
    const engineRef = useRef<Solver | null>(null);
    const skinningRef = useRef<SkinningData | null>(null);
    const initialized = useRef(false);

    useEffect(() => {
        if (!proxyMesh || !visualMesh || !mannequinMesh || initialized.current) return;

        console.log('[Adapter] Initializing Physics Engine V3...');

        // Initialize Solver
        const engine = new Solver(proxyMesh, mannequinMesh);
        engineRef.current = engine;

        // Initialize Skinning
        skinningRef.current = computeSkinning(visualMesh, proxyMesh);

        initialized.current = true;

    }, [proxyMesh, visualMesh, mannequinMesh]);

    useFrame((_, delta) => {
        const engine = engineRef.current;
        const skinning = skinningRef.current;

        if (!engine || !proxyMesh || !visualMesh || !skinning) return;

        // Safety Clamp for Delta Time
        const dt = Math.min(delta, 0.032);

        // Step Physics
        engine.update(dt);

        // Update Visual Mesh (Skinning)
        const visualPos = visualMesh.geometry.attributes.position;
        const proxyPos = engine.data.positions;
        const physicsIndex = proxyMesh.geometry.index!;
        const { indices, weights } = skinning;

        const pA = new THREE.Vector3();
        const pB = new THREE.Vector3();
        const pC = new THREE.Vector3();

        for (let i = 0; i < visualPos.count; i++) {
            const faceIdx = indices[i];
            const w1 = weights[i * 3];
            const w2 = weights[i * 3 + 1];
            const w3 = weights[i * 3 + 2];

            const idxA = physicsIndex.getX(faceIdx * 3) * 3;
            const idxB = physicsIndex.getX(faceIdx * 3 + 1) * 3;
            const idxC = physicsIndex.getX(faceIdx * 3 + 2) * 3;

            pA.set(proxyPos[idxA], proxyPos[idxA + 1], proxyPos[idxA + 2]);
            pB.set(proxyPos[idxB], proxyPos[idxB + 1], proxyPos[idxB + 2]);
            pC.set(proxyPos[idxC], proxyPos[idxC + 1], proxyPos[idxC + 2]);

            const x = pA.x * w1 + pB.x * w2 + pC.x * w3;
            const y = pA.y * w1 + pB.y * w2 + pC.y * w3;
            const z = pA.z * w1 + pB.z * w2 + pC.z * w3;

            visualPos.setXYZ(i, x, y, z);
        }

        visualPos.needsUpdate = true;
        visualMesh.geometry.computeVertexNormals();

        // Update bounds for raycasting
        visualMesh.geometry.computeBoundingSphere();

        // Debug Sync
        if (PHYSICS_CONSTANTS.debug.showProxy) {
            engine.data.syncToMesh(proxyMesh);
        }
    });

    return { engine: engineRef.current };
}