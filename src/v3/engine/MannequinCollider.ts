// src/v3/engine/collision/MannequinCollider.ts
import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

export interface CollisionResult {
    collided: boolean;
    rescued: boolean;
}

export class MannequinCollider {
    private bvh: MeshBVH | null = null;
    private mesh: THREE.Mesh | null = null;
    private inverseMatrix = new THREE.Matrix4();

    private tempVec = new THREE.Vector3();
    private tempTarget = { point: new THREE.Vector3(), distance: 0, faceIndex: -1 };
    private ray = new THREE.Ray();
    private rayDir = new THREE.Vector3(0.577, 0.577, 0.577).normalize();
    private tempNormal = new THREE.Vector3();
    private tempTri = new THREE.Triangle();

    // Increased offset to prevent visual mesh clipping
    private readonly SURFACE_OFFSET = 0.02; // 2.0cm (was 1.5cm)
    private readonly RESCUE_OFFSET = 0.025; // 2.5cm

    // Debug Data
    public debugData = {
        points: [] as THREE.Vector3[],
        colors: [] as THREE.Color[],
        lines: [] as THREE.Vector3[],
        stats: {
            insideCount: 0,
            contactCount: 0
        }
    };

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
        this.debugData.points = [];
        this.debugData.colors = [];
        this.debugData.lines = [];
        this.debugData.stats.insideCount = 0;
        this.debugData.stats.contactCount = 0;
    }

    public collide(position: THREE.Vector3): CollisionResult {
        const result: CollisionResult = { collided: false, rescued: false };
        if (!this.bvh || !this.mesh) return result;

        const localPos = this.tempVec.copy(position).applyMatrix4(this.inverseMatrix);
        const hit = this.bvh.closestPointToPoint(localPos, this.tempTarget);
        if (!hit) return result;

        // Raycast Winding Number Check
        this.ray.origin.copy(localPos);
        this.ray.direction.copy(this.rayDir);
        const rayHits = this.bvh.raycast(this.ray, THREE.DoubleSide);
        const isInside = rayHits.length % 2 !== 0;

        this.getFaceNormal(hit.faceIndex, this.tempNormal);
        const dist = localPos.distanceTo(hit.point);

        // --- CASE A: INSIDE (RESCUE) ---
        if (isInside) {
            // Push out significantly to ensure it clears the volume
            const targetLocal = hit.point.clone().addScaledVector(this.tempNormal, this.RESCUE_OFFSET);

            // Debug: Red + Normal Line
            this.addDebugPoint(hit.point, 1, 0, 0); // Red
            this.addDebugLine(hit.point, targetLocal);
            this.debugData.stats.insideCount++;

            position.copy(targetLocal).applyMatrix4(this.mesh.matrixWorld);
            result.collided = true;
            result.rescued = true;
        }
        // --- CASE B: SURFACE CONTACT ---
        else if (dist < this.SURFACE_OFFSET) {
            const targetLocal = hit.point.clone().addScaledVector(this.tempNormal, this.SURFACE_OFFSET);

            // Debug: Yellow
            this.addDebugPoint(hit.point, 1, 1, 0); // Yellow
            this.debugData.stats.contactCount++;

            position.copy(targetLocal).applyMatrix4(this.mesh.matrixWorld);
            result.collided = true;
            result.rescued = false;
        }

        return result;
    }

    private getFaceNormal(faceIndex: number, target: THREE.Vector3) {
        if (!this.mesh) return;
        const geo = this.mesh.geometry;
        const pos = geo.attributes.position;
        const idx = geo.index;

        if (idx) {
            const a = idx.getX(faceIndex * 3);
            const b = idx.getX(faceIndex * 3 + 1);
            const c = idx.getX(faceIndex * 3 + 2);
            this.tempTri.setFromAttributeAndIndices(pos, a, b, c);
        } else {
            const a = faceIndex * 3;
            const b = faceIndex * 3 + 1;
            const c = faceIndex * 3 + 2;
            this.tempTri.setFromAttributeAndIndices(pos, a, b, c);
        }
        this.tempTri.getNormal(target);
    }

    private addDebugPoint(localPoint: THREE.Vector3, r: number, g: number, b: number) {
        if (this.debugData.points.length > 1000) return;
        const worldPoint = localPoint.clone().applyMatrix4(this.mesh!.matrixWorld);
        this.debugData.points.push(worldPoint);
        this.debugData.colors.push(new THREE.Color(r, g, b));
    }

    private addDebugLine(localStart: THREE.Vector3, localEnd: THREE.Vector3) {
        if (this.debugData.lines.length > 2000) return;
        const worldStart = localStart.clone().applyMatrix4(this.mesh!.matrixWorld);
        const worldEnd = localEnd.clone().applyMatrix4(this.mesh!.matrixWorld);
        this.debugData.lines.push(worldStart, worldEnd);
    }
}