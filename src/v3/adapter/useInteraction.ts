// src/v3/adapter/useInteraction.ts

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib'; // Standard library for R3F controls
import { Solver } from '../engine/core/Solver';

export function useInteraction(
    solver: Solver | null,
    visualMesh: THREE.Mesh | null
) {
    const { gl, camera, raycaster, pointer, controls } = useThree();

    // State refs
    const isDragging = useRef(false);
    const draggedParticleIndex = useRef<number>(-1);

    // Math helpers (Refs to avoid GC)
    const dragPlane = useRef(new THREE.Plane());
    const mousePos3D = useRef(new THREE.Vector3());
    const tempVec = useRef(new THREE.Vector3());

    useEffect(() => {
        const canvas = gl.domElement;

        const handleDown = (e: PointerEvent) => {
            if (!visualMesh || !solver) return;

            // 1. Raycast against the VISUAL mesh (easier to hit)
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObject(visualMesh, true);

            if (intersects.length > 0) {
                const hit = intersects[0];

                // 2. Find nearest PHYSICS particle to the hit point
                let minDst = Infinity;
                let idx = -1;
                const pos = solver.data.positions;

                // Brute force search (fast enough for <2000 verts)
                for (let i = 0; i < solver.data.count; i++) {
                    tempVec.current.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
                    const dst = tempVec.current.distanceToSquared(hit.point);

                    if (dst < minDst) {
                        minDst = dst;
                        idx = i;
                    }
                }

                // Interaction Radius Threshold (e.g., 10cm)
                // If the click is too far from a real vertex, ignore it
                if (minDst < 0.05 && idx !== -1) {
                    // Prevent camera rotation while dragging
                    if (controls) {
                        (controls as OrbitControls).enabled = false;
                    }

                    isDragging.current = true;
                    draggedParticleIndex.current = idx;

                    // Setup drag plane facing the camera at the hit depth
                    const normal = new THREE.Vector3();
                    camera.getWorldDirection(normal);
                    dragPlane.current.setFromNormalAndCoplanarPoint(normal, hit.point);

                    // Stop event propagation if needed
                    e.stopPropagation();
                }
            }
        };

        const handleUp = () => {
            if (isDragging.current) {
                isDragging.current = false;
                draggedParticleIndex.current = -1;

                // Re-enable camera rotation
                if (controls) {
                    (controls as OrbitControls).enabled = true;
                }
            }
        };

        // Attach listeners to canvas
        canvas.addEventListener('pointerdown', handleDown);
        window.addEventListener('pointerup', handleUp);
        window.addEventListener('pointerleave', handleUp);

        return () => {
            canvas.removeEventListener('pointerdown', handleDown);
            window.removeEventListener('pointerup', handleUp);
            window.removeEventListener('pointerleave', handleUp);
        };
    }, [gl, camera, visualMesh, solver, pointer, raycaster, controls]);

    // Apply Physics Forces
    useFrame(() => {
        if (!isDragging.current || draggedParticleIndex.current === -1 || !solver) return;

        // 1. Project mouse to the 3D drag plane
        raycaster.setFromCamera(pointer, camera);
        raycaster.ray.intersectPlane(dragPlane.current, mousePos3D.current);

        // 2. Move the particle
        const idx = draggedParticleIndex.current * 3;

        const currentX = solver.data.positions[idx];
        const currentY = solver.data.positions[idx + 1];
        const currentZ = solver.data.positions[idx + 2];

        // "Mouse Spring" - Softly pull towards mouse
        // stiffness 0.1 = loose, 1.0 = rigid tracking
        const stiffness = 0.5;

        solver.data.positions[idx] += (mousePos3D.current.x - currentX) * stiffness;
        solver.data.positions[idx + 1] += (mousePos3D.current.y - currentY) * stiffness;
        solver.data.positions[idx + 2] += (mousePos3D.current.z - currentZ) * stiffness;

        // 3. Kill velocity to prevent orbiting/exploding when released
        // We set previous position close to current position to dampen momentum
        solver.data.prevPositions[idx] = solver.data.positions[idx];
        solver.data.prevPositions[idx + 1] = solver.data.positions[idx + 1];
        solver.data.prevPositions[idx + 2] = solver.data.positions[idx + 2];
    });
}