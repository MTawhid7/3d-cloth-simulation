import { useGLTF } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber'; // Added useFrame
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useClothWorker } from '../../adapter/bridge/useClothWorker'; // <--- Updated Path
import { useInteractionV4 } from '../../adapter/bridge/useInteractionV4'; // <--- NEW IMPORT
import { PHYSICS_CONSTANTS } from '../../shared/constants';

function findFirstMesh(scene: THREE.Group | THREE.Scene | THREE.Object3D): THREE.Mesh | null {
    let mesh: THREE.Mesh | null = null;
    scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh && !mesh) mesh = child as THREE.Mesh;
    });
    return mesh;
}

export const VirtualTryOnV4 = () => {
    const mannequinGLTF = useGLTF('/mannequin.glb');
    const proxyGLTF = useGLTF('/shirt_proxy.glb');
    const visualGLTF = useGLTF('/shirt_visual.glb');

    const mannequinMesh = useMemo(() => findFirstMesh(mannequinGLTF.scene), [mannequinGLTF]);
    const visual = useMemo(() => findFirstMesh(visualGLTF.scene), [visualGLTF]);

    const proxy = useMemo(() => {
        const rawMesh = findFirstMesh(proxyGLTF.scene);
        if (!rawMesh) return null;

        const geometry = rawMesh.geometry.clone();
        if (geometry.attributes.normal) geometry.deleteAttribute('normal');
        if (geometry.attributes.uv) geometry.deleteAttribute('uv');
        const weldedGeo = BufferGeometryUtils.mergeVertices(geometry, 0.001);

        const mesh = new THREE.Mesh(weldedGeo, rawMesh.material);
        mesh.position.copy(rawMesh.position);
        mesh.scale.copy(rawMesh.scale);
        mesh.updateMatrixWorld(true);
        return mesh;
    }, [proxyGLTF]);

    // 1. Initialize Engine
    const { buffers, worker } = useClothWorker(proxy, visual, mannequinMesh);

    // 2. Wire up Interaction
    // This connects the Mouse -> Shared Memory -> Worker
    useInteractionV4(buffers, visual, worker);

    // --- DEBUG VISUALIZER ---
    // Create a color attribute for the proxy mesh to show collision state
    const proxyMeshRef = useRef<THREE.Mesh>(null);

    useMemo(() => {
        if (proxy && proxy.geometry) {
            const count = proxy.geometry.attributes.position.count;
            // Initialize white colors
            const colors = new Float32Array(count * 3).fill(1);
            proxy.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }
    }, [proxy]);

    useFrame(() => {
        if (!buffers || !proxyMeshRef.current || !PHYSICS_CONSTANTS.debug?.showProxy) return;

        const colors = proxyMeshRef.current.geometry.attributes.color;
        const collisionData = buffers.collisions;

        for (let i = 0; i < collisionData.length; i++) {
            if (collisionData[i] === 1) {
                // RED (Colliding)
                colors.setXYZ(i, 1, 0, 0);
            } else {
                // GREEN (Safe) - Changed from white for better contrast
                colors.setXYZ(i, 0, 1, 0);
            }
        }
        colors.needsUpdate = true;
    });

    return (
        <group>
            <primitive object={mannequinGLTF.scene} />
            <primitive object={visualGLTF.scene}>
                {/* Made visual mesh semi-transparent so we can see the debug mesh inside */}
                <meshStandardMaterial
                    color="#4488ff"
                    roughness={0.6}
                    side={THREE.DoubleSide}
                    transparent
                    opacity={0.8}
                />
            </primitive>

            {/* Always render proxy if debug is on, now with Vertex Colors */}
            {PHYSICS_CONSTANTS.debug?.showProxy && proxy && (
                <primitive
                    object={proxy}
                    ref={proxyMeshRef}
                >
                    <meshBasicMaterial
                        vertexColors
                        wireframe
                        depthTest={false} // Always show on top
                    />
                </primitive>
            )}
        </group>
    );
};