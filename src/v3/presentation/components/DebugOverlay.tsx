import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export const DebugOverlay = () => {
    const { scene } = useThree();

    useEffect(() => {
        const analyzeMesh = (name: string) => {
            const object = scene.getObjectByName(name);
            if (!object) {
                console.warn(`⚠️ Could not find object: ${name}`);
                return;
            }

            console.group(`🔍 DIAGNOSTIC: ${name}`);

            // 1. World Scale (Accumulated from parents)
            const worldScale = new THREE.Vector3();
            object.getWorldScale(worldScale);
            console.log('World Scale:', worldScale.toArray());

            // 2. Bounding Box (Physical Size in Meters)
            const box = new THREE.Box3().setFromObject(object);
            const size = new THREE.Vector3();
            box.getSize(size);
            console.log('Bounding Box Size (Meters):', {
                width: size.x.toFixed(4),
                height: size.y.toFixed(4),
                depth: size.z.toFixed(4)
            });

            // 3. Vertex Check (Where is the first vertex?)
            if ((object as THREE.Mesh).geometry) {
                const pos = (object as THREE.Mesh).geometry.attributes.position;
                console.log('First Vertex (Local):',
                    pos.getX(0).toFixed(4),
                    pos.getY(0).toFixed(4),
                    pos.getZ(0).toFixed(4)
                );
            }
            console.groupEnd();
        };

        // Run analysis after a short delay to ensure loading
        setTimeout(() => {
            console.clear();
            console.log("🚀 STARTING SCENE GRAPH INSPECTION");

            // Analyze Mannequin (You might need to find the exact mesh name in Blender)
            // Usually it's the name of the object in the Outliner
            scene.traverse(child => {
                if (child.type === 'Mesh') {
                    analyzeMesh(child.name);
                }
            });
        }, 2000);

    }, [scene]);

    return (
        <group>
            <axesHelper args={[2]} />
            <gridHelper args={[10, 10]} />
        </group>
    );
};