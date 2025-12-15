import * as THREE from 'three';
import type { IPhysicsEngine } from '../simulation/IPhysicsEngine';
import type { Disposable } from '../types';

export class InteractionController implements Disposable {
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private plane = new THREE.Plane();
    private planeIntersect = new THREE.Vector3();

    private isDragging = false;
    private draggedParticleIndex: number | null = null;

    private canvas: HTMLElement;
    private camera: THREE.Camera;
    private physics: IPhysicsEngine;
    private mesh: THREE.Mesh;

    constructor(
        canvas: HTMLElement,
        camera: THREE.Camera,
        mesh: THREE.Mesh,
        physics: IPhysicsEngine
    ) {
        this.canvas = canvas;
        this.camera = camera;
        this.mesh = mesh;
        this.physics = physics;

        // Bind events
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        window.addEventListener('mouseup', this.onMouseUp);

        // Touch support (basic)
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
        window.addEventListener('touchend', this.onMouseUp);
    }

    private updateMouse(clientX: number, clientY: number) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    private findNearestParticle(point: THREE.Vector3): number | null {
        const positions = this.mesh.geometry.attributes.position.array;
        let minDist = Infinity;
        let index = -1;

        // Brute force search (sufficient for < 2000 particles)
        for (let i = 0; i < positions.length; i += 3) {
            const dx = point.x - positions[i];
            const dy = point.y - positions[i + 1];
            const dz = point.z - positions[i + 2];
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq < minDist) {
                minDist = distSq;
                index = i / 3;
            }
        }

        // Threshold: Only grab if within 0.1 units
        return minDist < 0.01 ? index : null;
    }

    private onMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return; // Only left click
        this.handleStart(e.clientX, e.clientY);
    };

    private onTouchStart = (e: TouchEvent) => {
        if (e.touches.length > 0) {
            e.preventDefault(); // Prevent scrolling
            this.handleStart(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    private handleStart(x: number, y: number) {
        this.updateMouse(x, y);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObject(this.mesh);
        if (intersects.length > 0) {
            const hitPoint = intersects[0].point;

            // Find nearest physics particle to the click
            this.draggedParticleIndex = this.findNearestParticle(hitPoint);

            if (this.draggedParticleIndex !== null) {
                this.isDragging = true;

                // Setup a virtual plane at the hit depth to drag against
                this.plane.setFromNormalAndCoplanarPoint(
                    this.camera.getWorldDirection(new THREE.Vector3()),
                    hitPoint
                );

                // Disable orbit controls if you have access, or stop propagation
                // For now, we rely on the fact that we are handling the logic
            }
        }
    }

    private onMouseMove = (e: MouseEvent) => {
        this.handleMove(e.clientX, e.clientY);
    };

    private onTouchMove = (e: TouchEvent) => {
        if (e.touches.length > 0) {
            e.preventDefault();
            this.handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    };

    private handleMove(x: number, y: number) {
        if (!this.isDragging || this.draggedParticleIndex === null) return;

        this.updateMouse(x, y);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        if (this.raycaster.ray.intersectPlane(this.plane, this.planeIntersect)) {
            // Move the pinned particle to the new mouse position
            this.physics.pinParticle(this.draggedParticleIndex, this.planeIntersect);
        }
    }

    private onMouseUp = () => {
        if (this.isDragging && this.draggedParticleIndex !== null) {
            this.physics.releaseParticle(this.draggedParticleIndex);
        }
        this.isDragging = false;
        this.draggedParticleIndex = null;
    };

    dispose() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        window.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        window.removeEventListener('touchend', this.onMouseUp);
    }
}