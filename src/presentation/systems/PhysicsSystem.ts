import * as THREE from 'three';
import { VerletPhysicsEngine } from '../../simulation/VerletPhysicsEngine';
import type { AppConfig } from '../../types';

export class PhysicsSystem {
    private engine: VerletPhysicsEngine;
    private config: AppConfig;

    constructor(engine: VerletPhysicsEngine, config: AppConfig) {
        this.engine = engine;
        this.config = config;
    }

    setupColliders() {
        // Mannequin standing at Y=0. Heights are approximate meters.

        // Head (Radius 0.12)
        this.engine.addCollisionSphere(new THREE.Vector3(0, 1.75, 0), 0.12);

        // Neck
        this.engine.addCollisionSphere(new THREE.Vector3(0, 1.60, 0), 0.09);

        // Shoulders (Wider to catch the sleeves)
        this.engine.addCollisionSphere(new THREE.Vector3(-0.20, 1.50, 0), 0.11);
        this.engine.addCollisionSphere(new THREE.Vector3(0.20, 1.50, 0), 0.11);

        // Chest / Upper Back
        this.engine.addCollisionSphere(new THREE.Vector3(0, 1.42, 0.02), 0.18);

        // Stomach
        this.engine.addCollisionSphere(new THREE.Vector3(0, 1.18, 0.02), 0.16);

        // Hips
        this.engine.addCollisionSphere(new THREE.Vector3(0, 0.95, 0), 0.18);
    }

    update(dt: number, mesh: THREE.Mesh | null) {
        if (this.config.physics.enabled && mesh) {
            this.engine.step(dt, mesh);
            this.engine.syncToMesh(mesh);
        }
    }
}