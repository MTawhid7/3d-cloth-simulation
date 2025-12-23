import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { type SharedBuffers, INTERACTION_OFFSET } from '../../shared/SharedMemory';

export function useInteractionV4(
    buffers: SharedBuffers | null,
    visualMesh: THREE.Mesh | null,
    worker: Worker | null
) {
    const { gl, camera, raycaster, pointer, controls } = useThree();

    const isDragging = useRef(false);
    const dragPlane = useRef(new THREE.Plane());
    const mousePos3D = useRef(new THREE.Vector3());

    useEffect(() => {
        if (!buffers || !visualMesh || !worker) return;
        const canvas = gl.domElement;

        const handleDown = (e: PointerEvent) => {
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObject(visualMesh, true);

            if (intersects.length > 0) {
                const hit = intersects[0];
                const point = hit.point;

                // Find nearest particle
                let minDst = Infinity;
                let idx = -1;
                const pos = buffers.positions;

                for (let i = 0; i < pos.length / 3; i++) {
                    const dx = pos[i * 3] - point.x;
                    const dy = pos[i * 3 + 1] - point.y;
                    const dz = pos[i * 3 + 2] - point.z;
                    const dst = dx * dx + dy * dy + dz * dz;

                    if (dst < minDst) {
                        minDst = dst;
                        idx = i;
                    }
                }

                if (minDst < 0.01 && idx !== -1) {
                    if (controls) (controls as OrbitControls).enabled = false;
                    isDragging.current = true;

                    const normal = new THREE.Vector3();
                    camera.getWorldDirection(normal);
                    dragPlane.current.setFromNormalAndCoplanarPoint(normal, point);

                    buffers.interaction[INTERACTION_OFFSET.STATE] = 1; // Dragging
                    buffers.interaction[INTERACTION_OFFSET.INDEX] = idx;
                    buffers.interaction[INTERACTION_OFFSET.TARGET_X] = point.x;
                    buffers.interaction[INTERACTION_OFFSET.TARGET_Y] = point.y;
                    buffers.interaction[INTERACTION_OFFSET.TARGET_Z] = point.z;

                    e.stopPropagation();
                }
            }
        };

        const handleUp = () => {
            if (isDragging.current) {
                isDragging.current = false;
                if (controls) (controls as OrbitControls).enabled = true;

                // Reset State
                buffers.interaction[INTERACTION_OFFSET.STATE] = 0;

                // Read the index we were holding to send the specific release command
                const index = buffers.interaction[INTERACTION_OFFSET.INDEX];
                worker.postMessage({
                    type: 'RELEASE',
                    index: index
                });
            }
        };

        canvas.addEventListener('pointerdown', handleDown);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointerleave', handleUp);

        return () => {
            canvas.removeEventListener('pointerdown', handleDown);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('pointerleave', handleUp);
        };
    }, [gl, camera, visualMesh, buffers, worker, pointer, raycaster, controls]);

    useFrame(() => {
        if (!isDragging.current || !buffers) return;

        raycaster.setFromCamera(pointer, camera);
        raycaster.ray.intersectPlane(dragPlane.current, mousePos3D.current);

        buffers.interaction[INTERACTION_OFFSET.TARGET_X] = mousePos3D.current.x;
        buffers.interaction[INTERACTION_OFFSET.TARGET_Y] = mousePos3D.current.y;
        buffers.interaction[INTERACTION_OFFSET.TARGET_Z] = mousePos3D.current.z;
    });
}