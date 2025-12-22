// src/v3/adapter/useInteraction.ts

import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';
import { Solver } from '../engine/core/Solver';

export function useInteraction(
    solver: Solver | null,
    visualMesh: THREE.Mesh | null
) {
    const { gl, camera, raycaster, pointer, controls } = useThree();

    const isDragging = useRef(false);
    const draggedParticleIndex = useRef<number>(-1);
    const originalInvMass = useRef<number>(1);

    const dragPlane = useRef(new THREE.Plane());
    const mousePos3D = useRef(new THREE.Vector3());
    const previousMousePos = useRef(new THREE.Vector3());

    useEffect(() => {
        const canvas = gl.domElement;

        const handleDown = (e: PointerEvent) => {
            if (!visualMesh || !solver) return;

            // 1. Raycast
            raycaster.setFromCamera(pointer, camera);
            const intersects = raycaster.intersectObject(visualMesh, true);

            if (intersects.length > 0) {
                const hit = intersects[0];

                // 2. Find nearest particle
                let minDst = Infinity;
                let idx = -1;
                const pos = solver.data.positions;
                const temp = new THREE.Vector3();

                for (let i = 0; i < solver.data.count; i++) {
                    temp.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
                    const dst = temp.distanceToSquared(hit.point);
                    if (dst < minDst) {
                        minDst = dst;
                        idx = i;
                    }
                }

                // Threshold 10cm
                if (minDst < 0.05 && idx !== -1) {
                    if (controls) (controls as OrbitControls).enabled = false;

                    isDragging.current = true;
                    draggedParticleIndex.current = idx;

                    // Store original mass (in case it was already pinned)
                    originalInvMass.current = solver.data.invMass[idx];

                    // PIN THE PARTICLE (Infinite Mass)
                    // This makes it follow the mouse exactly without fighting physics
                    solver.data.invMass[idx] = 0;

                    // Setup drag plane
                    const normal = new THREE.Vector3();
                    camera.getWorldDirection(normal);
                    dragPlane.current.setFromNormalAndCoplanarPoint(normal, hit.point);

                    // Init previous mouse pos for velocity calculation
                    previousMousePos.current.copy(hit.point);

                    e.stopPropagation();
                }
            }
        };

        const handleUp = () => {
            if (isDragging.current && draggedParticleIndex.current !== -1 && solver) {
                const idx = draggedParticleIndex.current;

                // UNPIN THE PARTICLE
                solver.data.invMass[idx] = originalInvMass.current;

                // THROW PHYSICS
                // Calculate velocity based on mouse movement: v = (current - prev) / dt
                // We approximate dt as 16ms (60fps) for the throw impulse
                const velocityX = (mousePos3D.current.x - previousMousePos.current.x) / 0.016;
                const velocityY = (mousePos3D.current.y - previousMousePos.current.y) / 0.016;
                const velocityZ = (mousePos3D.current.z - previousMousePos.current.z) / 0.016;

                // Apply velocity to prevPositions (Verlet integration style)
                // prevPos = currentPos - (velocity * dt)
                solver.data.prevPositions[idx * 3] = solver.data.positions[idx * 3] - (velocityX * 0.016);
                solver.data.prevPositions[idx * 3 + 1] = solver.data.positions[idx * 3 + 1] - (velocityY * 0.016);
                solver.data.prevPositions[idx * 3 + 2] = solver.data.positions[idx * 3 + 2] - (velocityZ * 0.016);

                isDragging.current = false;
                draggedParticleIndex.current = -1;

                if (controls) (controls as OrbitControls).enabled = true;
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
    }, [gl, camera, visualMesh, solver, pointer, raycaster, controls]);

    useFrame(() => {
        if (!isDragging.current || draggedParticleIndex.current === -1 || !solver) return;

        // Track previous position for velocity calculation
        previousMousePos.current.copy(mousePos3D.current);

        // Project mouse
        raycaster.setFromCamera(pointer, camera);
        raycaster.ray.intersectPlane(dragPlane.current, mousePos3D.current);

        // Move the pinned particle directly
        const idx = draggedParticleIndex.current * 3;
        solver.data.positions[idx] = mousePos3D.current.x;
        solver.data.positions[idx + 1] = mousePos3D.current.y;
        solver.data.positions[idx + 2] = mousePos3D.current.z;

        // Also update prevPosition to zero out velocity *during* the drag
        // This prevents the particle from building up massive energy while being held static
        solver.data.prevPositions[idx] = mousePos3D.current.x;
        solver.data.prevPositions[idx + 1] = mousePos3D.current.y;
        solver.data.prevPositions[idx + 2] = mousePos3D.current.z;
    });
}