import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { VirtualTryOn } from './components/VirtualTryOn';
import { DebugOverlay } from './components/DebugOverlay'; // <--- Import

export const SceneV3 = () => {
    return (
        <>
            <OrbitControls target={[0, 1.0, 0]} makeDefault />
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={1} castShadow />
            <Environment preset="city" />
            <ContactShadows resolution={1024} scale={10} blur={1} opacity={0.5} far={1} color="#000000" />

            <VirtualTryOn />

            {/* Add the Debug Overlay */}
            <DebugOverlay />
        </>
    );
};