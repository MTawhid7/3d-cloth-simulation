import { Mesh, Vector3, PlaneGeometry, BufferAttribute } from 'three';
import type { IPhysicsEngine, PhysicsConfig } from './IPhysicsEngine';
import type { Particle, Constraint, CollisionSphere } from './types';
import { ConstraintSolver } from './solvers/ConstraintSolver';
import { CollisionSolver } from './solvers/CollisionSolver';

export class VerletPhysicsEngine implements IPhysicsEngine {
    private particles: Particle[] = [];
    private constraints: Constraint[] = [];
    public collisionSpheres: CollisionSphere[] = [];
    private config: PhysicsConfig;
    private time = 0;

    private tmpForce = new Vector3();
    private windForce = new Vector3();
    private normal = new Vector3();

    constructor() {
        this.config = { gravity: -9.81, iterations: 5 };
    }

    addCollisionSphere(position: Vector3, radius: number) {
        this.collisionSpheres.push({ position, radius });
    }

    updateSpherePosition(index: number, pos: Vector3) {
        if (this.collisionSpheres[index]) {
            this.collisionSpheres[index].position.copy(pos);
        }
    }

    async initialize(mesh: Mesh, config: PhysicsConfig): Promise<void> {
        this.config = config;
        this.particles = [];
        this.constraints = [];
        this.collisionSpheres = [];

        const geometry = mesh.geometry;
        const positions = geometry.attributes.position.array;

        for (let i = 0; i < positions.length; i += 3) {
            const p = new Vector3(positions[i], positions[i + 1], positions[i + 2]);
            this.particles.push({
                position: p.clone(),
                prevPosition: p.clone(),
                originalPosition: p.clone(),
                acceleration: new Vector3(0, 0, 0),
                mass: 0.1,
                pinned: false,
            });
        }

        if (geometry instanceof PlaneGeometry) {
            const params = geometry.parameters;
            this.createGridConstraints(params.widthSegments, params.heightSegments);
        }
    }

    private createGridConstraints(w: number, h: number) {
        const width = w + 1;
        const height = h + 1;
        const add = (a: number, b: number) => {
            const dist = this.particles[a].position.distanceTo(this.particles[b].position);
            this.constraints.push({ p1: a, p2: b, restDistance: dist });
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = y * width + x;
                if (x < width - 1) add(i, i + 1);
                if (y < height - 1) add(i, i + width);
            }
        }
    }

    step(deltaTime: number, mesh?: Mesh): void {
        const dt = 18 / 1000;
        const dtSq = dt * dt;
        this.time += dt; // Slower time progression for smoother wind

        // 1. Calculate Wind (Gentle Breeze)
        this.calculateWind(this.time);

        // 2. Apply Aerodynamics
        if (mesh) {
            const normals = mesh.geometry.attributes.normal;
            for (let i = 0; i < this.particles.length; i++) {
                this.normal.fromBufferAttribute(normals as BufferAttribute, i);
                // Reduced wind multiplier from 10 to 2 for gentle effect
                this.tmpForce.copy(this.normal).normalize().multiplyScalar(this.normal.dot(this.windForce));
                this.particles[i].acceleration.add(this.tmpForce.multiplyScalar(2.0));
            }
        }

        const gravity = new Vector3(0, -9.81, 0).multiplyScalar(0.1);

        // 3. Integrate
        const drag = 0.97;
        for (const p of this.particles) {
            if (p.pinned) continue;

            p.acceleration.add(gravity);

            const velocity = p.position.clone().sub(p.prevPosition);
            velocity.multiplyScalar(drag);

            const nextPos = p.position.clone()
                .add(velocity)
                .add(p.acceleration.multiplyScalar(dtSq));

            p.prevPosition.copy(p.position);
            p.position.copy(nextPos);
            p.acceleration.set(0, 0, 0);
        }

        // 4. Solve
        for (let i = 0; i < this.config.iterations; i++) {
            ConstraintSolver.solve(this.particles, this.constraints);
            CollisionSolver.solve(this.particles, this.collisionSpheres);
        }
    }

    private calculateWind(now: number) {
        // Slower frequency (now / 2.0) and lower amplitude
        const windStrength = Math.cos(now / 2.0) * 5 + 10;
        this.windForce.set(
            Math.sin(now),
            Math.cos(now * 0.8),
            Math.sin(now * 0.5)
        );
        // Reduced scalar from 0.1 to 0.05
        this.windForce.normalize().multiplyScalar(windStrength * 0.05);
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

    pinIndices(indices: number[]) {
        indices.forEach(i => { if (this.particles[i]) this.particles[i].pinned = true; });
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

    applyForce(_i: number, _f: Vector3): void { }
    dispose(): void {
        this.particles = [];
        this.constraints = [];
        this.collisionSpheres = [];
    }
}