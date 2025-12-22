export const PHYSICS_CONSTANTS = {
    gravity: -9.81,
    substeps: 10,       // How many times the physics engine runs per frame.
                        // Increase (e.g., 20)	The cloth becomes Stiffer and Harder.
                        // Decrease(e.g., 1) The cloth becomes Softer and Looser.
    drag: 0.97,         // How much velocity is preserved from the previous frame.
                        // Increase (e.g., 0.999)	Low Air Resistance.
                        // Decrease (e.g., 0.8)	High Air Resistance.
    friction: 0.95,      // How much velocity is removed when a vertex touches the skin.
                        // Increase (e.g., 1.0)	Super Glue.
                        // Decrease (e.g., 0.1)	Ice / Teflon.
    compliance: 0.00001,  // How willing is the edge to break the rule "Stay 5cm apart"?
                        // Decrease (e.g., 0.000001)	The cloth becomes Rigid.
                        // Increase (e.g., 0.01)	The cloth becomes Stretchy.
    bendingMultiplier: 10, // Controls how easily the cloth folds compared to how easily it stretches.
    // Low Multiplier (e.g., 10): The cloth resists folding. It looks like Cardboard or Paper.
    // High Multiplier (e.g., 10000): The cloth folds effortlessly. It looks like Silk or Water.
    pinHeight: 100.0,   // Set high to disable pinning (we rely on collision)

    // Debug Flags
    debug: {
        showCapsules: false, // Show the Red Collision Cylinders
        showProxy: false     // Show the Yellow Physics Mesh
    }
};