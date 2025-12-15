import { Mesh, Vector3, PlaneGeometry } from 'three';
import type { IPhysicsEngine, PhysicsConfig } from './IPhysicsEngine';

interface Particle {
    position: Vector3;
    prevPosition: Vector3;
    originalPosition: Vector3;
    acceleration: Vector3;
    mass: number;
    pinned: boolean;
}

interface Constraint {
    p1: number;
    p2: number;
    restDistance: number;
}

export class VerletPhysicsEngine implements IPhysicsEngine {
    private particles: Particle[] = [];
    private constraints: Constraint[] = [];
    private config: PhysicsConfig;
    private widthSegments: number = 0;
    private heightSegments: number = 0;

    constructor() {
        this.config = { gravity: -9.81, iterations: 5 };
    }

    async initialize(mesh: Mesh, config: PhysicsConfig): Promise<void> {
        this.config = config;
        this.particles = [];
        this.constraints = [];

        const geometry = mesh.geometry;
        const positions = geometry.attributes.position.array;

        // 1. Create Particles from Mesh Vertices
        for (let i = 0; i < positions.length; i += 3) {
            const p = new Vector3(positions[i], positions[i + 1], positions[i + 2]);
            this.particles.push({
                position: p.clone(),
                prevPosition: p.clone(),
                originalPosition: p.clone(),
                acceleration: new Vector3(0, 0, 0),
                mass: 1.0,
                pinned: false,
            });
        }

        // 2. Setup Constraints (Structural & Shear)
        // FIX: Check if it is a PlaneGeometry to access parameters safely
        if (geometry instanceof PlaneGeometry) {
            const params = geometry.parameters;
            if (params && params.widthSegments && params.heightSegments) {
                this.widthSegments = params.widthSegments;
                this.heightSegments = params.heightSegments;
                this.createGridConstraints();
            }
        }

        // 3. Pin the top row (Simple T-shirt hanging simulation)
        // We pin indices 0 to widthSegments (the first row of vertices)
        for (let i = 0; i <= this.widthSegments; i++) {
            this.pinParticle(i, this.particles[i].position);
        }
    }

    private createGridConstraints() {
        const width = this.widthSegments + 1;
        const height = this.heightSegments + 1;

        const addConstraint = (a: number, b: number) => {
            const dist = this.particles[a].position.distanceTo(this.particles[b].position);
            this.constraints.push({ p1: a, p2: b, restDistance: dist });
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const index = y * width + x;

                // Structural (Right)
                if (x < width - 1) addConstraint(index, index + 1);

                // Structural (Bottom)
                if (y < height - 1) addConstraint(index, index + width);

                // Shear (Diagonal) - Adds stiffness
                if (x < width - 1 && y < height - 1) {
                    addConstraint(index, index + width + 1);
                    addConstraint(index + 1, index + width);
                }
            }
        }
    }

    step(deltaTime: number): void {
        const dt = Math.min(deltaTime, 0.032);
        const dtSq = dt * dt;
        const gravity = new Vector3(0, this.config.gravity, 0);

        // 1. Integrate (Verlet)
        for (const p of this.particles) {
            if (p.pinned) continue;

            const velocity = p.position.clone().sub(p.prevPosition);
            velocity.multiplyScalar(0.98); // Damping

            p.prevPosition.copy(p.position);

            const nextPos = p.position.clone()
                .add(velocity)
                .add(gravity.multiplyScalar(dtSq))
                .add(p.acceleration.multiplyScalar(dtSq));

            p.position.copy(nextPos);
            p.acceleration.set(0, 0, 0);
        }

        // 2. Solve Constraints
        const iterations = this.config.iterations;
        for (let i = 0; i < iterations; i++) {
            for (const c of this.constraints) {
                const p1 = this.particles[c.p1];
                const p2 = this.particles[c.p2];

                const diff = p1.position.clone().sub(p2.position);
                const currentDist = diff.length();

                if (currentDist === 0) continue;

                const correction = diff.multiplyScalar(1 - c.restDistance / currentDist);
                const scalar = 0.5;

                if (!p1.pinned) p1.position.sub(correction.clone().multiplyScalar(scalar));
                if (!p2.pinned) p2.position.add(correction.clone().multiplyScalar(scalar));
            }
        }
    }

    syncToMesh(mesh: Mesh): void {
        const positions = mesh.geometry.attributes.position.array as Float32Array;

        for (let i = 0; i < this.particles.length; i++) {
            positions[i * 3] = this.particles[i].position.x;
            positions[i * 3 + 1] = this.particles[i].position.y;
            positions[i * 3 + 2] = this.particles[i].position.z;
        }

        mesh.geometry.attributes.position.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
    }

    // FIX: Prefix unused parameters with _ to satisfy linter
    applyForce(_particleIndex: number, _force: Vector3): void {
        // To be implemented for interaction
    }

    pinParticle(index: number, pos: Vector3): void {
        if (this.particles[index]) {
            this.particles[index].pinned = true;
            this.particles[index].position.copy(pos);
        }
    }

    releaseParticle(index: number): void {
        if (this.particles[index]) this.particles[index].pinned = false;
    }

    dispose(): void {
        this.particles = [];
        this.constraints = [];
    }
}