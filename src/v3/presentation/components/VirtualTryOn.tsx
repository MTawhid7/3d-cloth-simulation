// src/v3/presentation/components/VirtualTryOn.tsx

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useClothEngine } from '../../adapter/useClothEngine';
import { PHYSICS_CONSTANTS } from '../../shared/constants';

// Helper to safely extract the first mesh from a GLTF scene
// This prevents TypeScript "type never" errors inside useMemo closures
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
    const mannequinGLTF = useGLTF('/mannequin.glb');
    const proxyGLTF = useGLTF('/shirt_proxy.glb');
    const visualGLTF = useGLTF('/shirt_visual.glb');

    // 1. Extract Mannequin Mesh (for Mesh Collision)
    const mannequinMesh = useMemo(() => {
        return findFirstMesh(mannequinGLTF.scene);
    }, [mannequinGLTF]);

    // 2. Extract and WELD the Proxy Mesh
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
        const weldedGeo = BufferGeometryUtils.mergeVertices(geometry, 0.001);
        weldedGeo.computeVertexNormals(); // Re-add normals just for visual debugging

        // Create a new mesh with the welded geometry
        const mesh = new THREE.Mesh(weldedGeo, rawMesh.material);

        // Copy transform from the loaded GLTF node
        mesh.position.copy(rawMesh.position);
        mesh.scale.copy(rawMesh.scale);
        mesh.quaternion.copy(rawMesh.quaternion);

        // Ensure the matrix is updated for the physics engine to read correct world positions
        mesh.updateMatrixWorld(true);

        return mesh;
    }, [proxyGLTF]);

    // 3. Extract Visual Mesh
    const visual = useMemo(() => {
        return findFirstMesh(visualGLTF.scene);
    }, [visualGLTF]);

    // 4. Initialize Physics Engine
    useClothEngine(proxy, visual, mannequinMesh);

    return (
        <group>
            {/* Mannequin */}
            <primitive object={mannequinGLTF.scene} />

            {/* Visual Shirt */}
            <primitive object={visualGLTF.scene} />

            {/* Debug: Proxy Shirt (Yellow) */}
            {PHYSICS_CONSTANTS.debug.showProxy && (
                <primitive object={proxyGLTF.scene}>
                    <meshBasicMaterial color="yellow" wireframe depthTest={false} />
                </primitive>
            )}
        </group>
    );
};