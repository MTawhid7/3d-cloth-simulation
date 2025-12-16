import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { assetManager } from '../AssetManager';

export class AssetLoaderSystem {
    static async loadMannequin(scene: THREE.Scene) {
        try {
            const gltf = await assetManager.loadGLTF('/mannequin.glb');
            const model = gltf.scene;

            // 1. Calculate Bounding Box
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            // 2. Center X/Z, but put Feet (min Y) at 0
            model.position.x += (model.position.x - center.x);
            model.position.z += (model.position.z - center.z);
            model.position.y = -box.min.y;

            model.traverse((child: any) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material = new THREE.MeshStandardMaterial({
                        color: 0xeeeeee, roughness: 0.5, metalness: 0.1
                    });
                }
            });
            scene.add(model);
            console.log("Mannequin loaded and aligned to floor");
            return model;
        } catch (e) {
            console.error("Error loading mannequin:", e);
        }
    }

    static async loadShirt(scene: THREE.Scene): Promise<THREE.Mesh> {
        try {
            const gltf = await assetManager.loadGLTF('/shirt.glb');
            const loadedMesh = this.findFirstMesh(gltf.scene);

            if (!loadedMesh) throw new Error("No mesh found in shirt.glb");

            console.log("Shirt Mesh Found:", loadedMesh.name);

            let geo = loadedMesh.geometry.clone();
            geo.deleteAttribute('uv');
            geo.deleteAttribute('normal');
            geo = BufferGeometryUtils.mergeVertices(geo, 0.01);
            geo.computeVertexNormals();

            // We trust Blender's alignment relative to the mannequin
            // Since we re-centered the mannequin, we might need to nudge the shirt
            // if it was exported relative to the mannequin's original center.
            // For now, we trust 0,0,0.

            const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
                color: 0x44aa88,
                side: THREE.DoubleSide,
                roughness: 0.8
            }));

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);

            return mesh;
        } catch (e) {
            console.error("Error loading shirt:", e);
            throw e;
        }
    }

    private static findFirstMesh(parent: THREE.Object3D): THREE.Mesh | null {
        if ((parent as any).isMesh) return parent as THREE.Mesh;
        if (parent.children.length > 0) {
            for (const child of parent.children) {
                const found = this.findFirstMesh(child);
                if (found) return found;
            }
        }
        return null;
    }
}