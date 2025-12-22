// src/v4/presentation/SceneV4.tsx
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { VirtualTryOnV4 } from './components/VirtualTryOnV4';

export const SceneV4 = () => {
    return (
        <>
            <OrbitControls target={[0, 1.0, 0]} makeDefault />

            {/* Lighting Setup */}
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
            <Environment preset="city" />

            {/* Shadows for grounding */}
            <ContactShadows
                resolution={1024}
                scale={10}
                blur={1}
                opacity={0.5}
                far={1}
                color="#000000"
            />

            {/* The V4 Engine Component */}
            <VirtualTryOnV4 />
        </>
    );
};