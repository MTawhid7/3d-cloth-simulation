import { Canvas } from '@react-three/fiber';
import { SceneV3 } from './v3/presentation/SceneV3';
import { SceneV4 } from './v4/presentation/SceneV4';
import { useState } from 'react';

const App = () => {
  const [version, setVersion] = useState<'v3' | 'v4'>('v4');

  return (
    <>
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        zIndex: 1000,
        background: 'white',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        fontFamily: 'sans-serif'
      }}>
        <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: '14px' }}>Engine Version</div>
        <label style={{ display: 'block', cursor: 'pointer', marginBottom: '4px' }}>
          <input
            type="radio"
            name="engine"
            checked={version === 'v3'}
            onChange={() => setVersion('v3')}
            style={{ marginRight: '8px' }}
          />
          V3 (Main Thread)
        </label>
        <label style={{ display: 'block', cursor: 'pointer' }}>
          <input
            type="radio"
            name="engine"
            checked={version === 'v4'}
            onChange={() => setVersion('v4')}
            style={{ marginRight: '8px' }}
          />
          V4 (Web Worker)
        </label>
      </div>

      <div style={{ width: '100vw', height: '100vh', background: '#e0e0e0' }}>
        <Canvas shadows camera={{ position: [0, 1.2, 2.5], fov: 45 }}>
          {version === 'v3' ? <SceneV3 /> : <SceneV4 />}
        </Canvas>
      </div>
    </>
  );
};

export default App;