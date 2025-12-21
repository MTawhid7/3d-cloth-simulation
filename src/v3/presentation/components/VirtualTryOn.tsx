// src/v3/presentation/components/VirtualTryOn.tsx

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useClothEngine } from '../../adapter/useClothEngine';
import { useInteraction } from '../../adapter/useInteraction';
import { PHYSICS_CONSTANTS } from '../../shared/constants';

// Helper to safely extract the first mesh from a GLTF scene
function findFirstMesh(scene: THREE.Group | THREE.Scene | THREE.Object3D): THREE.Mesh | null {
    let mesh: THREE.Mesh | null = null;
    scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !mesh) {
            mesh = child as THREE.Mesh;
        }
    });
    return mesh;
}

export const VirtualTryOn = () => {
    // 1. Load Assets
    const mannequinGLTF = useGLTF('/mannequin.glb');
    const proxyGLTF = useGLTF('/shirt_proxy.glb');
    const visualGLTF = useGLTF('/shirt_visual.glb');

    // 2. Extract Mannequin Mesh (for Mesh Collision)
    const mannequinMesh = useMemo(() => {
        return findFirstMesh(mannequinGLTF.scene);
    }, [mannequinGLTF]);

    // 3. Extract and WELD the Proxy Mesh (Physics Source)
    const proxy = useMemo(() => {
        const rawMesh = findFirstMesh(proxyGLTF.scene);
        if (!rawMesh) return null;

        // Clone geometry to avoid mutating the cached GLTF
        const geometry = rawMesh.geometry.clone();

        // CRITICAL FIX: Delete attributes that cause split vertices (Seams)
        // Physics doesn't need UVs or Normals, but they prevent merging.
        if (geometry.attributes.normal) geometry.deleteAttribute('normal');
        if (geometry.attributes.uv) geometry.deleteAttribute('uv');

        // Weld vertices within 1mm tolerance to create a single connected cloth sheet
        // This prevents the "Disintegration" issue
        const weldedGeo = BufferGeometryUtils.mergeVertices(geometry, 0.001);
        weldedGeo.computeVertexNormals();

        // Create a new mesh with the welded geometry
        const mesh = new THREE.Mesh(weldedGeo, rawMesh.material);

        // Copy transform from the loaded GLTF node
        mesh.position.copy(rawMesh.position);
        mesh.scale.copy(rawMesh.scale);
        mesh.quaternion.copy(rawMesh.quaternion);

        // Ensure the matrix is updated for the physics engine
        mesh.updateMatrixWorld(true);

        return mesh;
    }, [proxyGLTF]);

    // 4. Extract Visual Mesh (Render Target)
    const visual = useMemo(() => {
        return findFirstMesh(visualGLTF.scene);
    }, [visualGLTF]);

    // 5. Initialize Physics Engine
    // Returns the engine instance so we can pass it to the interaction handler
    const { engine } = useClothEngine(proxy, visual, mannequinMesh);

    // 6. Initialize Interaction (Mouse Grab)
    useInteraction(engine, visual);

    return (
        <group>
            {/* 1. Mannequin (Static Collider) */}
            <primitive object={mannequinGLTF.scene} />

            {/* 2. Visual Shirt (High Poly, Skinned) */}
            {/* This is the main render. It moves because useClothEngine updates its vertices. */}
            <primitive object={visualGLTF.scene}>
                <meshStandardMaterial
                    color="#4488ff"
                    roughness={0.6}
                    side={THREE.DoubleSide}
                />
            </primitive>

            {/* 3. Debug: Proxy Shirt (Low Poly Physics) */}
            {/* ONLY render if showProxy is true */}
            {PHYSICS_CONSTANTS.debug.showProxy && (
                <primitive object={proxyGLTF.scene}>
                    <meshBasicMaterial
                        color="yellow"
                        wireframe
                        transparent
                        opacity={0.5}
                        depthTest={false}
                    />
                </primitive>
            )}
        </group>
    );
};