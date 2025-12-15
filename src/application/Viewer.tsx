import React, { useEffect, useRef } from 'react';
import { SceneManager } from '../presentation/SceneManager';
import { detectCapability, getRuntimeConfig } from '../infrastructure/config';

export const Viewer: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneManagerRef = useRef<SceneManager | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // 1. Detect Capability & Config
        const capability = detectCapability();
        const config = getRuntimeConfig(capability);
        console.log(`Initializing Viewer with profile: ${capability}`);

        // 2. Initialize Scene Manager
        const sceneManager = new SceneManager(config);
        sceneManagerRef.current = sceneManager;

        sceneManager.initialize(containerRef.current).catch(console.error);

        // 3. Cleanup
        return () => {
            sceneManager.dispose();
        };
    }, []);

    return (
        <div
            ref={containerRef}
            style={{ width: '100%', height: '100vh', overflow: 'hidden' }}
        />
    );
};