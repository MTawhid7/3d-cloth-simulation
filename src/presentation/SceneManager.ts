import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AppConfig, Disposable } from '../types';
import { VerletPhysicsEngine } from '../simulation/VerletPhysicsEngine';
import { InteractionController } from './InteractionController';
import { PerformanceMonitor } from '../infrastructure/PerformanceMonitor';
import { RendererSystem } from './systems/RendererSystem';
import { ClothFactory } from './factories/ClothFactory';

export class SceneManager implements Disposable {
    private rendererSystem: RendererSystem;
    private physicsEngine: VerletPhysicsEngine;
    private interactionController: InteractionController | null = null;
    private perfMonitor: PerformanceMonitor;
    private controls: OrbitControls;

    private config: AppConfig;
    private clock: THREE.Clock;
    private requestID: number | null = null;
    private garmentMesh: THREE.Mesh | null = null;
    private ballMesh: THREE.Mesh | null = null;

    constructor(config: AppConfig) {
        this.config = config;
        this.clock = new THREE.Clock();

        this.rendererSystem = new RendererSystem(config);
        this.physicsEngine = new VerletPhysicsEngine();
        this.perfMonitor = new PerformanceMonitor();

        this.controls = new OrbitControls(this.rendererSystem.camera, this.rendererSystem.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.maxDistance = 15;
    }

    async initialize(container: HTMLElement): Promise<void> {
        this.rendererSystem.mount(container);

        this.rendererSystem.camera.position.set(0, 1.0, 5);
        this.controls.target.set(0, 1.0, 0);
        this.controls.update();

        this.setupLights();

        // 1. Create Cloth
        this.garmentMesh = await ClothFactory.createCloth(2, 2, 20);
        this.garmentMesh.position.set(0, 1.0, 0);
        this.rendererSystem.scene.add(this.garmentMesh);

        // 2. Create Ball
        this.createBall();

        // 3. Initialize Physics
        if (this.config.physics.enabled) {
            await this.physicsEngine.initialize(this.garmentMesh, {
                gravity: -9.81,
                iterations: 8
            });

            const pinIndices = [];
            for (let i = 0; i <= 20; i++) pinIndices.push(i);
            this.physicsEngine.pinIndices(pinIndices);

            // Add Ball Collision
            if (this.ballMesh) {
                // FIX: Convert initial ball pos to cloth local space
                const localPos = this.ballMesh.position.clone();
                this.garmentMesh.worldToLocal(localPos);

                this.physicsEngine.addCollisionSphere(localPos, 0.3);
            }
        }

        this.interactionController = new InteractionController(
            this.rendererSystem.renderer.domElement,
            this.rendererSystem.camera,
            this.garmentMesh,
            this.physicsEngine
        );

        this.startLoop();
    }

    private createBall() {
        const geometry = new THREE.SphereGeometry(0.3, 64, 64);
        const material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.4,
            metalness: 0.1
        });
        this.ballMesh = new THREE.Mesh(geometry, material);
        this.ballMesh.position.set(0, 1.0, 0.5);
        this.ballMesh.castShadow = true;
        this.ballMesh.receiveShadow = true;
        this.rendererSystem.scene.add(this.ballMesh);
    }

    private setupLights() {
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        const dir = new THREE.DirectionalLight(0xffffff, 1.0);
        dir.position.set(5, 10, 10);
        dir.castShadow = true;
        const fill = new THREE.DirectionalLight(0xffffff, 0.3);
        fill.position.set(-5, 2, 5);
        this.rendererSystem.scene.add(ambient, dir, fill);
    }

    private startLoop() {
        const animate = () => {
            this.requestID = requestAnimationFrame(animate);
            const deltaTime = this.clock.getDelta();
            const now = this.clock.getElapsedTime();

            this.perfMonitor.update();
            this.controls.update();

            if (this.ballMesh && this.garmentMesh) {
                // Animate Ball
                this.ballMesh.position.x = Math.sin(now * 0.5) * 0.5;
                this.ballMesh.position.z = Math.cos(now * 0.5) * 0.3 + 0.5;

                // FIX: Update collision in Local Space
                if (this.config.physics.enabled) {
                    // Clone world position, convert to local space of the cloth
                    const localPos = this.ballMesh.position.clone();
                    this.garmentMesh.worldToLocal(localPos);

                    this.physicsEngine.updateSpherePosition(0, localPos);
                }
            }

            if (this.config.physics.enabled && this.garmentMesh) {
                this.physicsEngine.step(deltaTime, this.garmentMesh);
                this.physicsEngine.syncToMesh(this.garmentMesh);
            }

            this.rendererSystem.renderer.render(this.rendererSystem.scene, this.rendererSystem.camera);
        };
        animate();
    }

    dispose(): void {
        if (this.requestID) cancelAnimationFrame(this.requestID);
        this.rendererSystem.dispose();
        this.physicsEngine.dispose();
        this.interactionController?.dispose();
        this.perfMonitor.dispose();
        this.controls.dispose();
    }
}