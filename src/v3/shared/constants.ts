export const PHYSICS_CONSTANTS = {
    gravity: -9.81,
    substeps: 5,         // 5-10 is good for stability
    drag: 0.975,         // Air resistance
    friction: 0.8,       // Friction against the body
    compliance: 0.000001,// Low compliance = Stiff fabric (Cotton/Denim)
    pinHeight: 100.0,    // Set high to disable pinning (we rely on collision)

    // Debug Flags
    debug: {
        showCapsules: true, // Show the Red Collision Cylinders
        showProxy: true     // Show the Yellow Physics Mesh
    }
};