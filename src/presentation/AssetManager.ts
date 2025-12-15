import { LoadingManager, TextureLoader } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
// Change to 'import type'
import type { Disposable } from '../types';

class AssetManager implements Disposable {
    private gltfLoader: GLTFLoader;
    // Removed unused textureLoader to fix warning
    private cache: Map<string, any> = new Map();

    constructor() {
        const manager = new LoadingManager();

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

        this.gltfLoader = new GLTFLoader(manager);
        this.gltfLoader.setDRACOLoader(dracoLoader);

        // Initialized but not stored since it wasn't used
        new TextureLoader(manager);
    }

    async loadModel(url: string): Promise<any> {
        if (this.cache.has(url)) return this.cache.get(url);

        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    this.cache.set(url, gltf);
                    resolve(gltf);
                },
                undefined,
                (error) => reject(error)
            );
        });
    }

    dispose(): void {
        this.cache.clear();
        // Dispose loaders if necessary in future versions
    }
}

export const assetManager = new AssetManager();