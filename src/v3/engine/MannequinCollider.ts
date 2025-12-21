import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

// Patch Three.js
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

export class MannequinCollider {
    private bvh: MeshBVH | null = null;
    private mesh: THREE.Mesh | null = null;
    private tempVec = new THREE.Vector3();
    private tempTarget = { point: new THREE.Vector3(), distance: 0, faceIndex: -1 };
    private inverseMatrix = new THREE.Matrix4();

    constructor(mesh?: THREE.Mesh) {
        if (mesh) this.setMesh(mesh);
    }

    public setMesh(mesh: THREE.Mesh) {
        this.mesh = mesh;

        // Ensure geometry has BVH
        if (!(this.mesh.geometry as any).boundsTree) {
            (this.mesh.geometry as any).computeBoundsTree();
        }
        this.bvh = (this.mesh.geometry as any).boundsTree;
    }

    public resolveCollision(position: THREE.Vector3): boolean {
        if (!this.bvh || !this.mesh) return false;

        // Update world matrix to handle mannequin animation/movement
        this.mesh.updateMatrixWorld();
        this.inverseMatrix.copy(this.mesh.matrixWorld).invert();

        // World -> Local
        this.tempVec.copy(position).applyMatrix4(this.inverseMatrix);

        // Check collision (radius 1.5cm)
        const hit = this.bvh.closestPointToPoint(this.tempVec, this.tempTarget);

        // If inside the "skin" buffer zone
        if (hit && hit.distance < 0.015) {
            // Push out direction
            const pushDir = this.tempVec.clone().sub(hit.point).normalize();

            // Move to surface + buffer
            this.tempVec.copy(hit.point).add(pushDir.multiplyScalar(0.015));

            // Local -> World
            position.copy(this.tempVec).applyMatrix4(this.mesh.matrixWorld);
            return true;
        }

        return false;
    }
}