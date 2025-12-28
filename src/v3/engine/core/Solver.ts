// src/v3/engine/core/Solver.ts
import * as THREE from 'three';
import { PhysicsData } from './PhysicsData';
import { DistanceConstraint } from '../constraints/DistanceConstraint';
import { BendingConstraint } from '../constraints/BendingConstraint';
import { MouseConstraint } from '../constraints/MouseConstraint';
import { MannequinCollider } from '../MannequinCollider';
import { SpatialHash } from './SpatialHash';
import { PHYSICS_CONSTANTS } from '../../shared/constants';

export class Solver {
    public data: PhysicsData;

    private distanceConstraints: DistanceConstraint;
    private bendingConstraints: BendingConstraint;
    private mouseConstraint: MouseConstraint;

    // Public for Debugging
    public collider: MannequinCollider;
    private selfCollider: SpatialHash;

    private tempVec = new THREE.Vector3();
    private tempPrev = new THREE.Vector3();

    constructor(proxyMesh: THREE.Mesh, collisionMesh: THREE.Mesh) {
        this.data = new PhysicsData(proxyMesh);

        this.distanceConstraints = new DistanceConstraint(proxyMesh.geometry, this.data);
        this.bendingConstraints = new BendingConstraint(proxyMesh.geometry, this.data);
        this.mouseConstraint = new MouseConstraint();

        this.collider = new MannequinCollider();
        this.collider.setMesh(collisionMesh);

        this.selfCollider = new SpatialHash(this.data.count);
    }

    public update(dt: number) {
        const substeps = PHYSICS_CONSTANTS.substeps;
        const sdt = dt / substeps;

        this.collider.updateMatrix();

        for (let step = 0; step < substeps; step++) {
            this.integrate(sdt);
            this.mouseConstraint.solve(this.data, sdt);
            this.distanceConstraints.solve(this.data, sdt);
            this.bendingConstraints.solve(this.data, sdt);
            this.solveCollisions();
            this.selfCollider.solve(this.data);
        }
    }

    private integrate(dt: number) {
        const gravity = PHYSICS_CONSTANTS.gravity * dt * dt;
        const drag = PHYSICS_CONSTANTS.drag;

        for (let i = 0; i < this.data.count; i++) {
            if (this.data.invMass[i] === 0) continue;

            const idx = i * 3;
            const x = this.data.positions[idx];
            const y = this.data.positions[idx + 1];
            const z = this.data.positions[idx + 2];

            const px = this.data.prevPositions[idx];
            const py = this.data.prevPositions[idx + 1];
            const pz = this.data.prevPositions[idx + 2];

            const nx = x + (x - px) * drag;
            const ny = y + (y - py) * drag + gravity;
            const nz = z + (z - pz) * drag;

            this.data.prevPositions[idx] = x;
            this.data.prevPositions[idx + 1] = y;
            this.data.prevPositions[idx + 2] = z;

            this.data.positions[idx] = nx;
            this.data.positions[idx + 1] = ny;
            this.data.positions[idx + 2] = nz;
        }
    }

    private solveCollisions() {
        for (let i = 0; i < this.data.count; i++) {
            if (this.data.invMass[i] === 0) continue;

            const idx = i * 3;
            this.tempVec.set(this.data.positions[idx], this.data.positions[idx + 1], this.data.positions[idx + 2]);
            this.tempPrev.set(this.data.prevPositions[idx], this.data.prevPositions[idx + 1], this.data.prevPositions[idx + 2]);

            if (this.collider.collide(this.tempVec, this.tempPrev)) {
                this.data.positions[idx] = this.tempVec.x;
                this.data.positions[idx + 1] = this.tempVec.y;
                this.data.positions[idx + 2] = this.tempVec.z;

                const f = PHYSICS_CONSTANTS.friction / PHYSICS_CONSTANTS.substeps;
                this.data.prevPositions[idx] += (this.data.positions[idx] - this.data.prevPositions[idx]) * f;
                this.data.prevPositions[idx + 1] += (this.data.positions[idx + 1] - this.data.prevPositions[idx + 1]) * f;
                this.data.prevPositions[idx + 2] += (this.data.positions[idx + 2] - this.data.prevPositions[idx + 2]) * f;
            }
        }
    }

    public startInteraction(index: number, point: THREE.Vector3) {
        this.data.interaction.active = true;
        this.data.interaction.particleIndex = index;
        this.data.interaction.target.copy(point);
    }

    public updateInteraction(point: THREE.Vector3) {
        if (this.data.interaction.active) {
            this.data.interaction.target.copy(point);
        }
    }

    public endInteraction(velocity: THREE.Vector3) {
        if (!this.data.interaction.active) return;
        const idx = this.data.interaction.particleIndex * 3;
        const dt = 0.016;
        const damping = PHYSICS_CONSTANTS.interaction.releaseDamping;

        this.data.prevPositions[idx] = this.data.positions[idx] - (velocity.x * dt * damping);
        this.data.prevPositions[idx + 1] = this.data.positions[idx + 1] - (velocity.y * dt * damping);
        this.data.prevPositions[idx + 2] = this.data.positions[idx + 2] - (velocity.z * dt * damping);

        this.data.interaction.active = false;
        this.data.interaction.particleIndex = -1;
    }
}