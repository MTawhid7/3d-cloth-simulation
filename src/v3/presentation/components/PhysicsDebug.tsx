// src/v3/presentation/components/PhysicsDebug.tsx
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Solver } from '../../engine/core/Solver';

export const PhysicsDebug = ({ engine }: { engine: Solver | null }) => {
    const hitsRef = useRef<THREE.InstancedMesh>(null);
    const dummy = new THREE.Object3D();
    const MAX_INSTANCES = 1000; // Must match the args below

    useFrame(() => {
        if (!engine || !hitsRef.current) return;

        const hits = engine.collider.debugHits;
        // CLAMP the count to prevent WebGL errors
        const count = Math.min(hits.length, MAX_INSTANCES);

        hitsRef.current.count = count;

        for (let i = 0; i < count; i++) {
            dummy.position.copy(hits[i]);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            hitsRef.current.setMatrixAt(i, dummy.matrix);
        }
        hitsRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <group>
            {/* The third argument '1000' is the buffer limit */}
            <instancedMesh ref={hitsRef} args={[undefined, undefined, MAX_INSTANCES]}>
                <sphereGeometry args={[0.005, 8, 8]} />
                <meshBasicMaterial color="red" depthTest={false} />
            </instancedMesh>
        </group>
    );
};