import * as THREE from 'three';
import { VerletPhysicsEngine } from '../../simulation/VerletPhysicsEngine';

export class DebugSystem {
    private debugMeshes: THREE.Mesh[] = [];
    // FIX: Explicit property declaration
    private scene: THREE.Scene;
    private engine: VerletPhysicsEngine;

    constructor(scene: THREE.Scene, engine: VerletPhysicsEngine) {
        this.scene = scene;
        this.engine = engine;
    }

    showColliders() {
        this.engine.collisionSpheres.forEach(sphere => {
            const geo = new THREE.SphereGeometry(sphere.radius, 16, 16);
            const mat = new THREE.MeshBasicMaterial({
                color: 0xff0000,
                wireframe: true,
                transparent: true,
                opacity: 0.3
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(sphere.position);
            this.scene.add(mesh);
            this.debugMeshes.push(mesh);
        });
    }

    dispose() {
        this.debugMeshes.forEach(m => {
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
            this.scene.remove(m);
        });
    }
}