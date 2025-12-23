// src/v4/engine/core/modules/CollisionSystem.ts

import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import { PHYSICS_CONSTANTS } from '../../../shared/constants';

(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

export class CollisionSystem {
    private colliderBVH: MeshBVH | null = null;
    private tempVec = new THREE.Vector3();
    private tempTarget = { point: new THREE.Vector3(), distance: 0, faceIndex: -1 };

    // Reusable objects for face normal calculation
    private vA = new THREE.Vector3();
    private vB = new THREE.Vector3();
    private vC = new THREE.Vector3();
    private faceNormal = new THREE.Vector3();
    private dirToVertex = new THREE.Vector3();

    private colliderIndex: THREE.BufferAttribute | null = null;
    private colliderPos: THREE.BufferAttribute | null = null;

    private debugCollisions: Uint8Array | null = null;

    // ============================================
    // USE THE UNIFIED SKIN OFFSET
    // ============================================
    private readonly THICKNESS = PHYSICS_CONSTANTS.SKIN_OFFSET;

    public setDebugBuffer(buffer: Uint8Array) {
        this.debugCollisions = buffer;
    }

    public setCollider(positionArray: Float32Array, indexArray: Int32Array) {
        const geometry = new THREE.BufferGeometry();
        const posAttr = new THREE.BufferAttribute(positionArray, 3);
        const indexAttr = new THREE.BufferAttribute(indexArray, 1);

        geometry.setAttribute('position', posAttr);
        geometry.setIndex(indexAttr);

        this.colliderBVH = new MeshBVH(geometry);
        this.colliderPos = posAttr;
        this.colliderIndex = indexAttr;

        console.log('[CollisionSystem] BVH Built with THICKNESS:', this.THICKNESS * 1000, 'mm');
    }

    /**
     * Resolves a single point to be outside the body.
     * Used by InteractionSystem for mouse grabbing.
     */
    public resolvePoint(x: number, y: number, z: number): { x: number, y: number, z: number } {
        if (!this.colliderBVH) return { x, y, z };

        this.tempVec.set(x, y, z);
        const hit = this.colliderBVH.closestPointToPoint(this.tempVec, this.tempTarget);

        if (hit) {
            this.getFaceNormal(hit.faceIndex);
            this.dirToVertex.subVectors(this.tempVec, hit.point);
            const dot = this.dirToVertex.dot(this.faceNormal);

            // If inside (dot < 0) OR too close (distance < THICKNESS)
            if (dot < 0 || hit.distance < this.THICKNESS) {
                const safePos = hit.point.clone().add(
                    this.faceNormal.multiplyScalar(this.THICKNESS)
                );
                return { x: safePos.x, y: safePos.y, z: safePos.z };
            }
        }
        return { x, y, z };
    }

    /**
     * Main collision resolution loop.
     * Projects all vertices outside the body and adjusts their velocity.
     */
    public solve(
        positions: Float32Array,
        prevPositions: Float32Array,
        invMass: Float32Array,
        friction: number
    ) {
        if (!this.colliderBVH || !this.colliderIndex || !this.colliderPos) return;

        const count = invMass.length;
        const f = 1 - friction; // Friction coefficient for velocity damping

        // Clear collision debug buffer at start of solve
        if (this.debugCollisions) {
            this.debugCollisions.fill(0); // Reset all to "not colliding"
        }

        for (let i = 0; i < count; i++) {
            if (invMass[i] === 0) continue; // Skip pinned vertices

            const idx = i * 3;
            let px = positions[idx];
            let py = positions[idx + 1];
            let pz = positions[idx + 2];

            // ============================================
            // 1. FLOOR COLLISION (Simple Plane)
            // ============================================
            const FLOOR_HEIGHT = 0.01; // 1cm above origin
            if (py < FLOOR_HEIGHT) {
                py = FLOOR_HEIGHT;
                positions[idx + 1] = py;

                // Apply friction: Damp horizontal velocity
                prevPositions[idx] = px - (px - prevPositions[idx]) * 0.5;
                prevPositions[idx + 2] = pz - (pz - prevPositions[idx + 2]) * 0.5;

                if (this.debugCollisions) this.debugCollisions[i] = 1; // Mark as colliding
                continue; // Skip body check if floor already handled it
            }

            // ============================================
            // 2. BODY COLLISION (BVH-Accelerated)
            // ============================================
            this.tempVec.set(px, py, pz);
            const hit = this.colliderBVH.closestPointToPoint(this.tempVec, this.tempTarget);

            if (hit) {
                this.getFaceNormal(hit.faceIndex);
                this.dirToVertex.subVectors(this.tempVec, hit.point);
                const dot = this.dirToVertex.dot(this.faceNormal);

                // Collision detected if:
                // - Vertex is behind face (dot < 0) OR
                // - Vertex is too close (distance < THICKNESS)
                if (dot < 0 || hit.distance < this.THICKNESS) {

                    // MARK AS COLLIDING (For debug visualization)
                    if (this.debugCollisions) this.debugCollisions[i] = 1;

                    // ----------------------------------------
                    // POSITION CORRECTION: Project to safe distance
                    // ----------------------------------------
                    const targetX = hit.point.x + this.faceNormal.x * this.THICKNESS;
                    const targetY = hit.point.y + this.faceNormal.y * this.THICKNESS;
                    const targetZ = hit.point.z + this.faceNormal.z * this.THICKNESS;

                    positions[idx] = targetX;
                    positions[idx + 1] = targetY;
                    positions[idx + 2] = targetZ;

                    // ----------------------------------------
                    // VELOCITY CORRECTION: Remove normal component
                    // ----------------------------------------
                    // Calculate current velocity (implicit in Verlet)
                    const vx = px - prevPositions[idx];
                    const vy = py - prevPositions[idx + 1];
                    const vz = pz - prevPositions[idx + 2];

                    // Project velocity onto face normal
                    const vDotN = vx * this.faceNormal.x + vy * this.faceNormal.y + vz * this.faceNormal.z;

                    if (vDotN < 0) {
                        // Velocity is pointing INTO the body - remove normal component
                        // This makes the cloth "slide" along the surface
                        const vTanX = vx - vDotN * this.faceNormal.x;
                        const vTanY = vy - vDotN * this.faceNormal.y;
                        const vTanZ = vz - vDotN * this.faceNormal.z;

                        // Update previous position to reflect new velocity
                        // Apply friction to tangential velocity
                        prevPositions[idx] = targetX - vTanX * f;
                        prevPositions[idx + 1] = targetY - vTanY * f;
                        prevPositions[idx + 2] = targetZ - vTanZ * f;
                    } else {
                        // Velocity pointing away - just apply friction
                        prevPositions[idx] = targetX - vx * f;
                        prevPositions[idx + 1] = targetY - vy * f;
                        prevPositions[idx + 2] = targetZ - vz * f;
                    }
                }
            }
        }
    }

    /**
     * Calculate face normal of a triangle.
     * Uses counter-clockwise winding for outward-facing normals.
     */
    private getFaceNormal(faceIndex: number) {
        if (!this.colliderIndex || !this.colliderPos) return;

        const i3 = faceIndex * 3;
        const a = this.colliderIndex.getX(i3);
        const b = this.colliderIndex.getX(i3 + 1);
        const c = this.colliderIndex.getX(i3 + 2);

        this.vA.fromBufferAttribute(this.colliderPos, a);
        this.vB.fromBufferAttribute(this.colliderPos, b);
        this.vC.fromBufferAttribute(this.colliderPos, c);

        // Cross product: (C - B) × (A - B)
        const cb = this.vC.sub(this.vB);
        const ab = this.vA.sub(this.vB);
        this.faceNormal.crossVectors(cb, ab).normalize();
    }
}