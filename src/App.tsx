import { Viewer } from './application/Viewer';
import './App.css';

function App() {
  return (
    <div className="App">
      <Viewer />
      {/* Overlay UI can go here later */}
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: 'black',
        background: 'rgba(255,255,255,0.8)',
        padding: '10px',
        borderRadius: '8px',
        pointerEvents: 'none'
      }}>
        <h2>MVP Garment Viewer</h2>
        <p>Phase 0: Foundation</p>
      </div>
    </div>
  );
}

export default App;