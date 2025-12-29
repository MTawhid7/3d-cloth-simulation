# 3D Garment Visualization Engine (V3)

![Status](https://img.shields.io/badge/Status-Active_Development-yellow) ![Tech](https://img.shields.io/badge/Tech-React_Three_Fiber_%7C_XPBD-blue) ![Physics](https://img.shields.io/badge/Physics-Custom_Solver-orange)

A high-performance, web-based Virtual Try-On (VTO) engine. This project simulates realistic fabric draping, stretching, and interaction in real-time using a custom **Extended Position Based Dynamics (XPBD)** solver, running entirely in the browser.

---

## 🎯 Project Objective

To achieve "Industrial Grade" cloth simulation on the web without the performance overhead of heavy gaming engines. The goal is a **Virtual Fitting Room** where users can:

1. **Visualize** garments with high-fidelity rendering (wrinkles, thickness).
2. **Interact** physically (grab, pull, stretch, throw).
3. **Assess Fit** (Tight vs. Oversized) based on physical tension.

---

## 🏗️ Architecture: The "Two-Mesh" Strategy

Real-time cloth simulation faces a dilemma: **Visuals need high resolution** (smooth folds), but **Physics needs low resolution** (stability). We solved this using a decoupled architecture:

### 1. The Physics Proxy (Invisible)

* **Mesh:** A low-poly, uniform triangulation (~1,000 vertices).
* **Role:** Calculates constraints, gravity, and collision.
* **Solver:** Custom **XPBD (TypeScript)**. It solves distance and bending constraints to simulate stiffness and structural integrity.
* **Collision:** Uses **MeshBVH** to collide against the actual Mannequin geometry, allowing for precise draping over complex shapes (shoulders, chest).

### 2. The Visual Mesh (Visible)

* **Mesh:** High-quality geometry (~15,000+ vertices) with modeled thickness (extruded hems) and smooth normals.
* **Role:** Pure rendering. It does *not* run physics calculations.

### 3. The Skinning Bridge

We map the high-res visual mesh to the low-res physics mesh using **Barycentric Interpolation**:

1. **Init:** Every visual vertex is mapped to the nearest triangle on the physics proxy.
2. **Update:** As the proxy deforms, the visual vertices move relative to their parent triangle's barycentric weights.
3. **Result:** Smooth, high-quality cloth that moves realistically, driven by a fast, stable simulation.

---

## 🛠️ Technology Stack

| Component | Technology | Rationale |
| :--- | :--- | :--- |
| **Framework** | **React Three Fiber** | Declarative 3D scene management. |
| **Physics** | **Custom XPBD (TS)** | Deterministic, stable constraints. Replaced Rapier (Rigid Bodies) for better cloth behavior. |
| **Collision** | **three-mesh-bvh** | Accelerated raycasting for accurate mesh-on-mesh collision. |
| **State** | **React Refs / Mutable** | Direct manipulation of `Float32Array` for zero-garbage-collection loops. |
| **Pipeline** | **Blender** | Custom asset preparation (Decimation, Welding, Origin Reset). |

---

## 🔬 Collision Detection System

The engine uses a multi-layered collision approach to prevent cloth penetration:

### Cloth-Body Collision (MannequinCollider)

Two-phase detection using **three-mesh-bvh**:

1. **CCD (Continuous Collision Detection):** Raycasts along each particle's trajectory to detect tunneling before it happens. This prevents fast-moving particles from passing through the body mesh.

2. **Discrete Collision:** Uses `closestPointToPoint()` for particles at rest or moving slowly. Detects when particles are inside the mesh or within the surface buffer zone.

**Key Parameters:**

* `SURFACE_BUFFER` (1.2cm): Normal offset from body surface
* `RESCUE_BUFFER` (2.0cm): Stronger push for deep penetration rescue

### Self-Collision (Spatial Hashing)

Prevents cloth from passing through itself:

1. **Spatial Hash Grid:** Partitions space into 8mm cells for O(1) neighbor lookup
2. **Particle Pairs:** Each particle queries neighbors within thickness radius
3. **Separation Correction:** Pushes overlapping particles apart along their connection vector

**Key Parameters:**

* `thickness` (8mm): Minimum separation distance
* `stiffness` (0.25): Soft response to prevent oscillation

### Collision Response

When collision is detected:

1. Particle position is corrected to surface + buffer
2. **Velocity Kill:** For rescue (deep penetration), velocity is zeroed to prevent bounce-back
3. **Friction:** For surface contact, velocity is dampened based on friction coefficient

---

## 📜 The Evolution (Lessons Learned)

### ❌ V1: Verlet Integration

* **Approach:** Basic $F=ma$ particle system.
* **Failure:** Cloth felt like rubber. Super stretchy and unstable.

### ❌ V2: Rapier (Rigid Body Grid)

* **Approach:** 1,000 spheres connected by Impulse Joints.
* **Failure:** "Jittering." Rigid bodies fight each other when packed tightly. The shirt looked like it was vibrating. Interaction felt disconnected (kinematic). Colliders allowed tunneling.

### ✅ V3: XPBD (Current)

* **Approach:** Constraint Projection. We enforce rules ("Edge A must be length L") rather than forces.
* **Success:**
  * **Stable Resting:** The shirt sits stably on the body without exploding or sliding off over time.
  * **Realistic Stretching:** Fabric stretches naturally and stops at reasonable limits, mimicking real material properties.
  * **Unconditional Stability:** The simulation handles extreme forces without crashing (NaN protection).
  * **Realism:** Bending constraints prevent the "crumpled paper" look.
  * **Interaction:** "Kinematic Grabbing" allows users to throw the fabric.
  * **Safety:** Added clamps to reset vertices if they exceed world bounds.

---

## 📂 Project Structure

```text
src/
├── v3/
│   ├── adapter/
│   │   ├── useClothEngine.ts   # The Bridge: Connects React state to the Physics Loop
│   │   └── useInteraction.ts   # Mouse/Touch logic (Raycasting & Kinematic Grabs)
│   ├── engine/
│   │   ├── core/
│   │   │   ├── PhysicsData.ts   # Manages Float32Arrays (Positions, Velocities)
│   │   │   ├── Solver.ts        # The Heart: Integration -> Constraints -> Collision
│   │   │   └── SpatialHash.ts   # Spatial partitioning for self-collision
│   │   ├── constraints/
│   │   │   ├── DistanceConstraint.ts # Structural integrity (Stretching)
│   │   │   └── BendingConstraint.ts  # Stiffness (Folding)
│   │   └── MannequinCollider.ts      # MeshBVH wrapper for body collision (CCD + Discrete)
│   ├── presentation/
│   │   └── components/
│   │       └── VirtualTryOn.tsx # Loads assets, welds geometry, renders scene
│   ├── shared/
│   │   └── constants.ts        # Tuning knobs (Gravity, Compliance, Drag)
│   └── utils/
│       └── skinning.ts         # Barycentric mapping logic
└── App.tsx                     # Entry point
```

---

## 📝 Asset Requirements (Blender Pipeline)

For the simulation to work, assets must be prepared strictly following this pipeline.

### 1. Global Alignment

* **Origin:** The Mannequin and Shirt **MUST** have their Origin Point at `(0,0,0)` (between the feet).
* **Scale:** Apply all transforms (`Ctrl+A` -> All Transforms). Scale must be `1.0`.

### 2. The Proxy Mesh (`shirt_proxy.glb`)

* **Source:** Duplicate the visual shirt.
* **Clean:** Remove thickness/hems. It must be a single-layer sheet.
* **Weld:** Use `Merge by Distance` to ensure seams are connected.
* **Topology:** Use **Decimate (Collapse)** to ~1,200 faces, then **Triangulate**, then **Beautify Faces** (Alt+Shift+F) to make triangles uniform.
* **Cage:** Use `Alt+S` (Shrink/Fatten) to puff it out by **2mm** (so it encapsulates the visual mesh).

### 3. The Visual Mesh (`shirt_visual.glb`)

* **Detail:** ~15,000 faces.
* **Thickness:** Extrude the hems/collar inward to create the illusion of volume.
* **Placement:** Must sit *inside* the Proxy mesh.

---

## 🎛️ Tuning Physics (`constants.ts`)

You can define the material properties in `src/v3/shared/constants.ts`.

| Variable | Value | Effect |
| :--- | :--- | :--- |
| `compliance` | `0.000` - `0.01` | **Inverse Stiffness.** 0 = Steel, 0.001 = Denim, 0.01 = Spandex. |
| `drag` | `0.90` - `0.99` | **Air Resistance.** Lower = Heavy/Underwater. Higher = Float/Silk. |
| `friction` | `0.0` - `1.0` | **Stickiness.** 0 = Ice, 1.0 = Glue. Controls slipping off shoulders. |
| `substeps` | `5` - `10` | **Quality.** Higher = Stiffer, more stable collision, higher CPU cost. |

---

## ⚠️ Known Limitations

### Active Issues (Under Investigation)

1. **Minor Vibration (Wind Effect):** In certain areas, the cloth exhibits a subtle vibration, giving the impression of wind affecting the fabric. This is likely due to micro-collisions or constraint solver jitter at rest.

### Other Limitations

1. **Self-Collision Oscillation:** With complex folds, self-collision can cause minor jitter. Mitigated by soft stiffness.
2. **Single Garment:** Currently optimized for one garment at a time.
3. **No GPU Acceleration:** All physics runs on CPU in the main thread.

---

## 🔮 Future Roadmap

1. **Web Worker Offloading:** Move physics solver to a Web Worker to free main thread.
2. **WASM Optimization:** Port `Solver.ts` to **Rust/WebAssembly** for 5-10x performance.
3. **Wind Simulation:** Add aerodynamic drag forces based on triangle normals.
4. **Fit Analysis:** Visualize tension maps (Red = Tight, Green = Loose) on the visual mesh.
5. **Multi-Garment Layering:** Support jacket over shirt with proper inter-garment collision.
6. **GPU Compute:** Explore WebGPU compute shaders for massively parallel constraint solving.

---

## 📦 Installation

1. **Clone:**

    ```bash
    git clone https://github.com/MTawhid7/3d-cloth-simulation.git
    cd 3d-cloth-simulation
    ```

2. **Install:**

    ```bash
    npm install
    ```

3. **Run:**

    ```bash
    npm run dev
    ```
