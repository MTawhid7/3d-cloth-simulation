export const PHYSICS_CONSTANTS = {
    gravity: -9.81,
    substeps: 10,         // 5-10 is good for stability
    drag: 0.98,         // Air resistance
    friction: 0.9,       // Friction against the body
    compliance: 0.00000001,// Low compliance = Stiff fabric (Cotton/Denim)
    pinHeight: 100.0,    // Set high to disable pinning (we rely on collision)

    // Debug Flags
    debug: {
        showCapsules: false, // Show the Red Collision Cylinders
        showProxy: false     // Show the Yellow Physics Mesh
    }
};