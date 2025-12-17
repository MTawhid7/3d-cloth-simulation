# 3D Garment Visualization MVP

A high-performance, web-based 3D cloth simulation engine built with **React**, **Three.js**, and a custom **Verlet Integration Physics Engine**.

This project demonstrates a lightweight, browser-native approach to virtual try-on technology, prioritizing performance and accessibility over industrial-grade accuracy.

---

## 🎯 Project Goal

To create a "Virtual Fitting Room" MVP that allows users to:

1. View a 3D garment draped over a mannequin.
2. Interact with the fabric in real-time (grab, pull, drag).
3. Run smoothly (60 FPS) on standard web browsers without heavy WASM dependencies like Ammo.js or PhysX.

---

## 🏗️ Architecture & Strategy

### 1. The Physics Engine (Custom Verlet)

Instead of using heavy libraries, we implemented a custom **Position-Based Dynamics (PBD)** solver using Verlet Integration.

* **Why?** It is numerically stable, fast, and easy to control.
* **How it works:**
  * **Particles:** The shirt vertices are treated as particles with mass.
  * **Constraints:** Edges between vertices act as springs that resist stretching.
  * **Integration:** We calculate the next position based on the previous position and acceleration (Gravity + Wind), without storing velocity explicitly.

### 2. Collision Detection (BVH)

We use **Bounding Volume Hierarchies (BVH)** via `three-mesh-bvh` for collision.

* **Strategy:** Instead of checking every cloth particle against every body triangle (O(N^2)), we build a spatial tree of the mannequin.
* **Process:** For every frame, each cloth particle queries the BVH tree to find the nearest point on the body surface. If it penetrates the surface, it is projected back out along the normal vector.

### 3. Asset Pipeline

* **Mannequin:** A standard GLB model, merged into a single geometry at runtime to serve as a unified collider.
* **Garment:** A low-poly (~2,500 faces) GLB model. We use `BufferGeometryUtils.mergeVertices` to "sew" the seams at runtime, preventing the mesh from falling apart during simulation.

---

## 🚀 Key Features

* **Real-time Cloth Simulation:** Gravity, wind, and drag forces applied to thousands of particles.
* **Mesh-on-Mesh Collision:** Accurate draping over complex human forms using BVH.
* **Interactive Controls:** Users can grab and pull the fabric using raycasting.
* **Debug Visualization:** Built-in tools to visualize the physics collider wireframes and particle clouds.
* **Performance Monitoring:** Integrated FPS counter and adaptive quality settings.

---

## 🛠️ Technical Challenges & Solutions

| Challenge | Solution |
| :--- | :--- |
| **"Confetti Effect"** (Shirt exploding) | The GLTF loader splits vertices at UV seams. We implemented a pre-processing step to delete UVs/Normals and weld vertices by distance (`0.01` tolerance) before physics initialization. |
| **Cloth Sliding Off** | The physics surface was too slippery. We added a **Friction Coefficient (0.9)** to the collision response, dampening tangential velocity when particles touch the body. |
| **Misalignment** | The visual mesh and physics collider were desynchronized due to auto-centering logic. We removed the auto-centering and now rely on strict **Blender-to-Three.js coordinate parity** (0,0,0 origin). |
| **Performance** | High-poly meshes killed FPS. We implemented a **Decimate** workflow in Blender to reduce face count to <5k and lowered physics iterations to 3 for stability. |

---

## 🔮 Future Roadmap

### Phase 3: Visual Fidelity (Next Steps)

* **Double-Sided Rendering:** Give the cloth thickness visually (using a shader or extrusion) so it doesn't look like "flakes."
* **Texture Mapping:** Re-introduce UVs. We will need to map the simulation positions back to the original unwelded mesh to support textures.
* **Self-Collision:** Prevent the cloth from clipping through itself (requires spatial hashing).

### Phase 4: Advanced Physics

* **Stiffness Control:** Add "Shear" and "Bend" constraints to simulate different fabric types (e.g., Silk vs. Denim).
* **Wind Zones:** Implement directional wind fields that react to the mannequin's occlusion.

---

## 📦 Installation

1. **Clone the repository:**

    ```bash
    git clone https://github.com/MTawhid7/garment-viewer.git
    cd garment-viewer
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Run Development Server:**

    ```bash
    npm run dev
    ```

4. **Build for Production:**

    ```bash
    npm run build
    ```

---

## 🎮 Controls

* **Left Click + Drag:** Rotate Camera.
* **Right Click + Drag:** Pan Camera.
* **Scroll:** Zoom.
* **Click on Shirt:** Grab and pull the fabric.
