// src/v3/engine/collision/MannequinCollider.ts
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

export class MannequinCollider {
    private bvh: MeshBVH | null = null;
    private mesh: THREE.Mesh | null = null;
    private inverseMatrix = new THREE.Matrix4();

    private tempVec = new THREE.Vector3();
    private tempTarget = { point: new THREE.Vector3(), distance: 0, faceIndex: -1 };

    // Debug Data (Public for PhysicsDebug.tsx)
    public debugHits: THREE.Vector3[] = [];
    public debugRays: THREE.Line3[] = []; // Kept for compatibility, though unused in logic

    private readonly SURFACE_OFFSET = 0.015;

    public setMesh(mesh: THREE.Mesh) {
        this.mesh = mesh;
        if (!(this.mesh.geometry as any).boundsTree) {
            (this.mesh.geometry as any).computeBoundsTree();
        }
        this.bvh = (this.mesh.geometry as any).boundsTree;
    }

    public updateMatrix() {
        if (this.mesh) {
            this.mesh.updateMatrixWorld();
            this.inverseMatrix.copy(this.mesh.matrixWorld).invert();
        }
        // Clear debug data every frame
        this.debugHits = [];
        this.debugRays = [];
    }

    public collide(position: THREE.Vector3, prevPosition: THREE.Vector3): boolean {
        if (!this.bvh || !this.mesh) return false;

        const localPos = this.tempVec.copy(position).applyMatrix4(this.inverseMatrix);
        const hit = this.bvh.closestPointToPoint(localPos, this.tempTarget);

        if (!hit) return false;

        const toParticle = localPos.clone().sub(hit.point);
        const dist = toParticle.length();

        if (dist < this.SURFACE_OFFSET) {
            let normal = toParticle.clone();
            if (dist < 0.000001) {
                const localPrev = prevPosition.clone().applyMatrix4(this.inverseMatrix);
                normal.subVectors(localPrev, hit.point);
            }
            normal.normalize();

            const targetLocal = hit.point.clone().addScaledVector(normal, this.SURFACE_OFFSET);

            // Debug Visualization
            const worldHit = hit.point.clone().applyMatrix4(this.mesh.matrixWorld);
            this.debugHits.push(worldHit);

            position.copy(targetLocal).applyMatrix4(this.mesh.matrixWorld);
            return true;
        }

        return false;
    }
}