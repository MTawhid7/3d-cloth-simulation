// src/v3/shared/constants.ts
export const PHYSICS_CONSTANTS = {
    gravity: -9.81,
    substeps: 10,
    drag: 0.97,             // Slightly more air resistance for stability
    friction: 0.3,          // Lower friction to prevent "sticking" to the body

    // Material Properties
    compliance: 0.00001,    // 1e-5 = Cotton/Denim (Good balance)
    bendingCompliance: 2.0, // Much higher value = Softer folds (Less "Cardboard" look)

    // Interaction
    interaction: {
        stiffness: 0.0,     // 0.0 = Infinite Stiffness (Hard Constraint). The cloth MUST follow the mouse.
        maxForce: 1000,
        releaseDamping: 0.2
    },

    pinHeight: 100.0,

    debug: {
        showProxy: false,
        showBounds: false,
        showActiveConstraint: true
    }
};