// src/v4/engine/utils/GeometryPreprocessor.ts

import * as THREE from 'three';
import type { SharedBuffers } from '../../shared/SharedMemory';
import { PHYSICS_CONSTANTS } from '../../shared/constants';

export class GeometryPreprocessor {
    static process(
        proxyGeo: THREE.BufferGeometry,
        mannequinGeo: THREE.BufferGeometry,
        views: SharedBuffers
    ) {
        const vertexCount = proxyGeo.attributes.position.count;
        const initialPos = proxyGeo.attributes.position;

        // Ensure mannequin has BVH for collision detection
        if (!mannequinGeo.boundsTree) {
            mannequinGeo.computeBoundsTree();
        }
        const colliderBvh = mannequinGeo.boundsTree!;

        const tempVec = new THREE.Vector3();
        const tempTarget = { point: new THREE.Vector3(), distance: 0, faceIndex: -1 };

        // ============================================
        // USE THE UNIFIED SKIN OFFSET
        // ============================================
        // This MUST match CollisionSystem.ts
        const SAFETY_GAP = PHYSICS_CONSTANTS.SKIN_OFFSET;

        const mPos = mannequinGeo.attributes.position;
        const mInd = mannequinGeo.index!;
        const vA = new THREE.Vector3();
        const vB = new THREE.Vector3();
        const vC = new THREE.Vector3();
        const faceNormal = new THREE.Vector3();
        const dirToVertex = new THREE.Vector3();

        console.log(`[Preprocessor] Initializing ${vertexCount} vertices with SKIN_OFFSET: ${SAFETY_GAP * 1000}mm`);

        for (let i = 0; i < vertexCount; i++) {
            let px = initialPos.getX(i);
            let py = initialPos.getY(i);
            let pz = initialPos.getZ(i);

            tempVec.set(px, py, pz);

            // Find nearest point on mannequin body
            const hit = colliderBvh.closestPointToPoint(tempVec, tempTarget);

            if (hit) {
                // Calculate face normal of the nearest triangle
                const ia = mInd.getX(hit.faceIndex * 3);
                const ib = mInd.getX(hit.faceIndex * 3 + 1);
                const ic = mInd.getX(hit.faceIndex * 3 + 2);

                vA.fromBufferAttribute(mPos, ia);
                vB.fromBufferAttribute(mPos, ib);
                vC.fromBufferAttribute(mPos, ic);

                const cb = new THREE.Vector3().subVectors(vC, vB);
                const ab = new THREE.Vector3().subVectors(vA, vB);
                faceNormal.crossVectors(cb, ab).normalize();

                // Determine if vertex is inside or too close
                dirToVertex.subVectors(tempVec, hit.point);
                const dot = dirToVertex.dot(faceNormal);

                // If inside (dot < 0) OR too close (distance < SAFETY_GAP)
                if (dot < 0 || hit.distance < SAFETY_GAP) {
                    // PROJECT OUT: Place vertex at exactly SAFETY_GAP distance along normal
                    px = hit.point.x + faceNormal.x * SAFETY_GAP;
                    py = hit.point.y + faceNormal.y * SAFETY_GAP;
                    pz = hit.point.z + faceNormal.z * SAFETY_GAP;
                }
            }

            // Write to shared memory
            views.positions[i * 3] = px;
            views.positions[i * 3 + 1] = py;
            views.positions[i * 3 + 2] = pz;

            // Initialize previous position (zero velocity at start)
            views.prevPositions[i * 3] = px;
            views.prevPositions[i * 3 + 1] = py;
            views.prevPositions[i * 3 + 2] = pz;

            // ============================================
            // PINNING LOGIC: Collar/Shoulder Area
            // ============================================
            // We pin vertices that are high enough (near shoulders)
            // and close to the centerline (near neck)
            const isHighEnough = py > 1.65;  // Above shoulder line
            const isCloseToNeck = Math.abs(px) < 0.08; // Within 8cm of center

            if (isHighEnough && isCloseToNeck) {
                views.invMass[i] = 0; // Pin it (infinite mass)
            } else {
                views.invMass[i] = 1; // Dynamic (unit mass)
            }
        }

        console.log('[Preprocessor] Initialization complete. All vertices positioned at unified SKIN_OFFSET.');
    }
}