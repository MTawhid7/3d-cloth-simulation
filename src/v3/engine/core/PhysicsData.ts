import * as THREE from 'three';
import { PHYSICS_CONSTANTS } from '../../shared/constants';

export class PhysicsData {
    public readonly count: number;
    public positions: Float32Array;
    public prevPositions: Float32Array;
    public invMass: Float32Array;

    constructor(mesh: THREE.Mesh) {
        // Assume mesh is already welded by the Component
        const posAttr = mesh.geometry.attributes.position;
        this.count = posAttr.count;

        this.positions = new Float32Array(this.count * 3);
        this.prevPositions = new Float32Array(this.count * 3);
        this.invMass = new Float32Array(this.count);

        this.init(posAttr);
    }

    private init(posAttr: THREE.BufferAttribute | THREE.InterleavedBufferAttribute) {
        for (let i = 0; i < this.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);

            this.positions[i * 3] = x;
            this.positions[i * 3 + 1] = y;
            this.positions[i * 3 + 2] = z;

            this.prevPositions[i * 3] = x;
            this.prevPositions[i * 3 + 1] = y;
            this.prevPositions[i * 3 + 2] = z;

            if (y > PHYSICS_CONSTANTS.pinHeight) {
                this.invMass[i] = 0;
            } else {
                this.invMass[i] = 1.0;
            }
        }
    }

    public syncToMesh(mesh: THREE.Mesh) {
        const posAttr = mesh.geometry.attributes.position;
        for (let i = 0; i < this.count; i++) {
            posAttr.setXYZ(i, this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
        }
        posAttr.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
    }
}