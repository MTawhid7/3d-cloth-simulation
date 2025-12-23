// src/v4/shared/constants.ts

export const PHYSICS_CONSTANTS = {
    // ============================================
    // CRITICAL: The "One Truth" for Skin Distance
    // ============================================
    // This value MUST be used everywhere:
    // - GeometryPreprocessor (initialization)
    // - CollisionSystem (runtime collision)
    // - InteractionSystem (mouse grabbing)
    //
    // WHY 1.5cm?
    // - Small enough to look fitted (not puffy)
    // - Large enough to prevent tunneling during constraint solving
    // - Accounts for ~0.5cm of constraint correction per substep
    SKIN_OFFSET: 0.015, // 1.5cm - The Holy Grail of Consistency

    // Physics Behavior
    gravity: -9.81,

    substeps: 20,       // How many times the physics engine runs per frame.
    // Increase (e.g., 25)	→ Stiffer, more stable (higher CPU cost)
    // Decrease (e.g., 15) → Softer, faster (less stable)

    drag: 0.97,         // How much velocity is preserved from the previous frame.
    // Increase (e.g., 0.995) → Low air resistance (floaty)
    // Decrease (e.g., 0.90)  → High air resistance (heavy)

    friction: 0.95,      // How much velocity is removed when touching the body.
    // Increase (e.g., 1.0)  → Super glue (no sliding)
    // Decrease (e.g., 0.1)  → Ice (slides off shoulders)

    compliance: 0.00001,  // How willing edges are to stretch.
    // Decrease (e.g., 0.000001) → Rigid (like cardboard)
    // Increase (e.g., 0.001)    → Stretchy (like spandex)

    bendingMultiplier: 10, // Controls folding vs stretching.
    // Low (e.g., 10)     → Resists folding (paper-like)
    // High (e.g., 10000) → Folds easily (silk-like)

    pinHeight: 100.0,   // Set high to disable pinning (we use collision instead)

    // Debug Flags
    debug: {
        showCapsules: false, // Show collision cylinders
        showProxy: true      // Show physics mesh with red/green collision state
    }
};