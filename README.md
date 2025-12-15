# MVP Garment Viewer

A high-performance, web-based 3D garment visualization tool built with **React**, **Three.js**, and a custom **Verlet Integration Physics Engine**.

This project demonstrates a lightweight architecture for simulating cloth dynamics in the browser without heavy external physics libraries.

## 🚀 Features

* **Real-time Cloth Simulation:** Custom Verlet integration engine supporting gravity, structural constraints, and shear constraints.
* **Interactive Manipulation:** Grab and drag the fabric naturally using mouse or touch inputs.
* **Performance Monitoring:** Built-in FPS tracker and adaptive quality system.
* **Robust Error Handling:** Graceful degradation strategies for WebGL context loss and physics instability.
* **Optimized Rendering:** Uses Three.js with ACES Filmic tone mapping and efficient geometry updates.

## 🛠️ Technology Stack

* **Core:** React 18, TypeScript, Vite 5
* **3D Rendering:** Three.js (r160+)
* **Physics:** Custom TypeScript Verlet Solver (No external physics WASM dependency)
* **State Management:** Zustand (Architecture ready)
* **Styling:** CSS Modules / SCSS

## 📂 Architecture

The project follows a strict separation of concerns:

* **`src/presentation`**: Handles the View layer (Three.js SceneManager, InteractionController).
* **`src/simulation`**: Pure math/physics logic (VerletPhysicsEngine).
* **`src/infrastructure`**: Cross-cutting concerns (Config, PerformanceMonitor).
* **`src/application`**: React UI components and business logic.

## 📦 Installation & Setup

1. **Clone the repository:**

    ```bash
    git clone https://github.com/MTawhid7/3d-cloth-simulation.git
    cd 3d-cloth-simulation
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

## 🎮 Controls

* **Left Click + Drag (on cloth):** Grab and pull the fabric.
* **Right Click + Drag:** Rotate the camera.
* **Scroll:** Zoom in/out.
* **Debug:** Click "Test Physics Crash" to verify error handling systems.

## 📈 Current Status

**Phase 2 Complete (Polish & Optimization):**

* [x] Basic Physics Integration
* [x] Interaction Controller

* [x] High-res cloth mesh

* [x] Performance Monitoring

* [x] Error Boundaries & Recovery
