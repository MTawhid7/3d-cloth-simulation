import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AppConfig, Disposable } from '../types';
import { VerletPhysicsEngine } from '../simulation/VerletPhysicsEngine';
import { InteractionController } from './InteractionController';
import { PerformanceMonitor } from '../infrastructure/PerformanceMonitor';

export class SceneManager implements Disposable {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private requestID: number | null = null;
    private container: HTMLElement | null = null;
    private config: AppConfig;

    // Physics & Interaction Properties
    private physicsEngine: VerletPhysicsEngine;
    private garmentMesh: THREE.Mesh | null = null;
    private interactionController: InteractionController | null = null;
    private perfMonitor: PerformanceMonitor;
    private clock: THREE.Clock;

    constructor(config: AppConfig) {
        this.config = config;
        this.clock = new THREE.Clock();
        this.physicsEngine = new VerletPhysicsEngine();
        this.perfMonitor = new PerformanceMonitor(); // Initialize Monitor

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);

        // Camera FOV 45
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 0, 2);

        this.renderer = new THREE.WebGLRenderer({
            antialias: config.rendering.antialias,
            powerPreference: 'high-performance'
        });

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, config.rendering.pixelRatioMax));

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Remap controls: Left Click for Grab, Right Click for Rotate
        this.controls.mouseButtons = {
            LEFT: null as any,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        };
    }

    async initialize(container: HTMLElement): Promise<void> {
        this.container = container;
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(this.renderer.domElement);

        this.setupLights();
        this.setupResizeHandler();

        // 1. Create Cloth Mesh (Solid Texture)
        await this.createClothMesh();

        // 2. Initialize Physics
        if (this.garmentMesh && this.config.physics.enabled) {
            await this.physicsEngine.initialize(this.garmentMesh, {
                gravity: this.config.physics.gravity,
                iterations: this.config.physics.constraintIterations
            });
        }

        // 3. Initialize Interaction Controller
        if (this.garmentMesh) {
            this.interactionController = new InteractionController(
                this.renderer.domElement,
                this.camera,
                this.garmentMesh,
                this.physicsEngine
            );
        }

        this.startLoop();
    }

    private async createClothMesh() {
        // 20x20 Grid for smoother simulation
        const geometry = new THREE.PlaneGeometry(1, 1, 20, 20);
        geometry.translate(0, 0.5, 0);

        // Load UV Grid Texture for visualization
        const loader = new THREE.TextureLoader();
        // Using a reliable placeholder texture
        const texture = loader.load('https://threejs.org/examples/textures/uv_grid_opengl.jpg');
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;

        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: texture,          // Apply texture
            side: THREE.DoubleSide,
            wireframe: false,      // Disable wireframe
            roughness: 0.6,
            metalness: 0.1
        });

        this.garmentMesh = new THREE.Mesh(geometry, material);

        // Enable shadow casting support
        this.garmentMesh.castShadow = true;
        this.garmentMesh.receiveShadow = true;

        this.scene.add(this.garmentMesh);
    }

    private setupLights() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1);
        dirLight.position.set(5, 10, 7);
        dirLight.castShadow = true;
        this.scene.add(ambientLight, dirLight);
    }

    private setupResizeHandler() {
        window.addEventListener('resize', this.onWindowResize);
    }

    private onWindowResize = () => {
        if (!this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    };

    private startLoop() {
        const animate = () => {
            this.requestID = requestAnimationFrame(animate);

            const deltaTime = this.clock.getDelta();

            // Update Performance Monitor
            this.perfMonitor.update();

            // Physics Step
            if (this.config.physics.enabled && this.garmentMesh) {
                this.physicsEngine.step(deltaTime);
                this.physicsEngine.syncToMesh(this.garmentMesh);
            }

            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }

    dispose(): void {
        if (this.requestID) cancelAnimationFrame(this.requestID);
        window.removeEventListener('resize', this.onWindowResize);

        this.controls.dispose();
        this.renderer.dispose();
        this.physicsEngine.dispose();
        this.interactionController?.dispose();
        this.perfMonitor.dispose(); // Dispose Monitor

        if (this.container && this.renderer.domElement.parentNode === this.container) {
            this.container.removeChild(this.renderer.domElement);
        }

        this.scene.traverse((object) => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                if (object.material instanceof THREE.Material) {
                    object.material.dispose();
                }
            }
        });
    }
}