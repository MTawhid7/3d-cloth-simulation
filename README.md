# 3D Garment Visualization Engine (V2)

A high-performance, web-based 3D virtual try-on (VTO) engine built with **React Three Fiber**, **Rapier (WASM)**, and a custom **Skinning Pipeline**.

This project demonstrates a scalable architecture for simulating high-fidelity cloth on the web without the performance penalties of traditional soft-body physics engines.

---

## 🎯 Project Objective

To create an industrial-grade "Virtual Fitting Room" that allows users to:

1. **Visualize** garments (Cotton, Denim, Silk) on a 3D mannequin.
2. **Interact** with the fabric (grab, pull, drape) in real-time.
3. **Scale** to millions of users by running entirely client-side (no expensive cloud GPU streaming).

---

## 🏗️ Architecture: The "Two-Mesh" Strategy

Real-time cloth simulation faces a dilemma: **Visuals need high resolution** (smooth folds), but **Physics needs low resolution** (stability). Simulating a high-poly shirt directly causes "jitter," "explosions," and low FPS.

We solved this using a **Proxy-Drive System**:

### 1. The Physics Proxy (Invisible)

* **Mesh:** A decimated, low-poly cage (~500 vertices).
* **Engine:** **Rapier.rs** (Rust/WASM).
* **Method:** We treat the cloth as a grid of **Rigid Bodies** connected by **Impulse Joints** (Springs).
* **Role:** Handles collision against the mannequin, gravity, and wind. It is fast and stable because the particle count is low.

### 2. The Visual Mesh (Visible)

* **Mesh:** High-quality geometry (~5,000+ vertices) with smooth normals and UVs.
* **Engine:** **Three.js** (GPU Rendering).
* **Role:** Purely aesthetic. It does *not* run physics.

### 3. The Skinning Bridge

We implemented a custom **Barycentric Mapping System**:

1. **Initialization:** We map every vertex of the *Visual Mesh* to the nearest triangle on the *Physics Proxy*.
2. **Runtime:** As the Proxy moves and deforms, we interpolate the position of the Visual vertices based on their barycentric weights.
3. **Result:** The user sees a high-quality smooth shirt that moves realistically, driven by a hidden low-poly simulation.

---

## 🛠️ Technology Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Rendering** | **React Three Fiber (R3F)** | Declarative 3D scene management; industry standard for React. |
| **Physics** | **Rapier (WASM)** | Modern, actively maintained, and significantly faster than Ammo.js. |
| **State** | **Zustand** | Transient state management for high-frequency updates without re-renders. |
| **Collision** | **Trimesh / BVH** | Accurate mesh-on-mesh collision detection. |
| **Debug** | **Visulizers** | Custom tools for visualizing velocity, collisions, and physics bodies in real-time. |
| **Pipeline** | **Blender** | Custom asset preparation (Decimation, Welding, Origin Reset). |

---

## 📉 Current Status (Phase 2 - Realism & Tuning)

**✅ Completed:**

* **Engine Migration:** Successfully moved from custom Verlet (JS) to Rapier (WASM).
* **Asset Pipeline:** Established a workflow to clean, weld, and export GLB assets from Blender.
* **Collision:** The shirt collides with the mannequin using Trimesh colliders.
* **Self-Collision Fix:** Implemented Collision Groups to prevent the "inflated balloon" effect.
* **Skinning Logic:** The barycentric interpolation math is implemented.
* **Debug Suite:** Added comprehensive visualizers for physics debugging:
  * `CollisionDebugger`: Visualizes active contact points.
  * `PhysicsVisualizer`: Shows the underlying rigid bodies and colliders.
  * `VelocityVisualizer`: Color-coded velocity tracking for stability analysis.

**⚠️ Known Issues / In Progress:**

* **Physics Tuning:** Fine-tuning `physics.config.ts` to reduce jitter and improve "settling" behavior.
* **Interaction:** Improving the mouse grab sensation (currently kinematic coupling) to feel more "elastic".
* **Visual Artifacts:** Occasional clipping where the proxy mesh might protrude if parameters aren't tuned correctly.

---

## 📂 Project Structure

```text
src/
├── v2/
│   ├── components/
│   │   ├── avatar/       # Mannequin (Static Collider)
│   │   ├── garment/      # Shirt.tsx (The Simulation Core)
│   │   ├── debug/        # Visualizers (Collision, Velocity, Physics)
│   │   ├── ui/           # User Interface controls
│   │   └── canvas/       # Scene Setup (Lights, Camera)
│   ├── config/           # Physics configuration parameters
│   ├── hooks/
│   │   ├── useGarmentPhysics.ts  # Rapier Body/Joint creation & Logic
│   │   ├── useGarmentLoader.ts   # Asset loading & Welding logic
│   │   └── useGarmentInteraction.ts # Mouse Drag logic
│   ├── types/            # TypeScript definitions
│   └── utils/
│       ├── geometry.ts   # Mesh processing (Welding)
│       └── skinning.ts   # Barycentric mapping math
├── legacy/               # Archived V1 (Verlet) engine
└── App.tsx               # Entry point
```

---

## 📝 Asset Requirements (Blender)

For the simulation to work, assets must be prepared strictly:

1. **Topology:** Uniform triangles (no long thin slivers).
2. **Watertight:** No holes. Front and back panels must be merged (`Merge by Distance`).
3. **Scale:** Applied to `1.0`.
4. **Origin:** Centered at `(0,0,0)` at the feet of the mannequin.
5. **Proxy Generation:**
    * Duplicate the shirt.
    * Apply **Decimate Modifier** (Ratio ~0.1) to get <800 vertices.
    * Apply **Shrink/Fatten** to puff it out by 2mm (encapsulating the visual mesh).

---

## 🔮 Future Roadmap

1. **Realism Tuning:** Deep dive into `physics.config.ts` to achieve fabric-specific behaviors (Cotton vs. Silk).
2. **Interaction Polish:** Replace the kinematic mouse grab with a "Mouse Spring" for elastic pulling.
3. **Performance Optimization:** Explore WebWorkers for the physics loop to ensure 60 FPS under heavier loads.
4. **UI Enhancement:** Add controls to tweak physics parameters in real-time for easier debugging.

---

## 📦 Installation

1. **Clone:**

    ```bash
    git clone [repo-url]
    cd garment-viewer
    ```

2. **Install:**

    ```bash
    npm install
    ```

3. **Run:**

    ```bash
    npm run dev
    ```
