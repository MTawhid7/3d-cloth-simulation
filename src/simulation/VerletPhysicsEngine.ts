import { Mesh, Vector3, BufferAttribute } from 'three';
import type { IPhysicsEngine, PhysicsConfig } from './IPhysicsEngine';
import type { Particle, Constraint, CollisionSphere } from './types';
import { ConstraintSolver } from './solvers/ConstraintSolver';
import { CollisionSolver } from './solvers/CollisionSolver';
import { Adjacency } from './utils/Adjacency'; // Import the helper

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

        // Ensure geometry is indexed (critical for cloth)
        if (!geometry.index) {
            // If not indexed, we would need to merge vertices.
            // For MVP, we assume the loader provides indexed geometry.
            throw new Error("Cloth mesh must be indexed (shared vertices).");
        }

        const positions = geometry.attributes.position.array;

        // 1. Create Particles
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

        // 2. Create Constraints from Mesh Topology
        const edges = Adjacency.findEdges(geometry);

        for (const edge of edges) {
            const p1 = this.particles[edge.a];
            const p2 = this.particles[edge.b];
            const dist = p1.position.distanceTo(p2.position);

            this.constraints.push({
                p1: edge.a,
                p2: edge.b,
                restDistance: dist
            });
        }

        console.log(`Physics Initialized: ${this.particles.length} particles, ${this.constraints.length} constraints`);
    }


    step(deltaTime: number, mesh?: Mesh): void {
        const dt = 18 / 1000;
        const dtSq = dt * dt;
        this.time += dt;

        this.calculateWind(this.time);

        if (mesh) {
            const normals = mesh.geometry.attributes.normal;
            for (let i = 0; i < this.particles.length; i++) {
                this.normal.fromBufferAttribute(normals as BufferAttribute, i);
                this.tmpForce.copy(this.normal).normalize().multiplyScalar(this.normal.dot(this.windForce));
                this.particles[i].acceleration.add(this.tmpForce.multiplyScalar(2.0));
            }
        }

        const gravity = new Vector3(0, -9.81, 0).multiplyScalar(0.1);

        const drag = 0.97;
        for (const p of this.particles) {
            if (p.pinned) continue;
            p.acceleration.add(gravity);
            const velocity = p.position.clone().sub(p.prevPosition);
            velocity.multiplyScalar(drag);
            const nextPos = p.position.clone().add(velocity).add(p.acceleration.multiplyScalar(dtSq));
            p.prevPosition.copy(p.position);
            p.position.copy(nextPos);
            p.acceleration.set(0, 0, 0);
        }

        for (let i = 0; i < this.config.iterations; i++) {
            ConstraintSolver.solve(this.particles, this.constraints);
            CollisionSolver.solve(this.particles, this.collisionSpheres);
        }
    }

    private calculateWind(now: number) {
        const windStrength = Math.cos(now / 2.0) * 5 + 10;
        this.windForce.set(Math.sin(now), Math.cos(now * 0.8), Math.sin(now * 0.5));
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