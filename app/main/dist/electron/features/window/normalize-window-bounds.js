"use strict";

function createWindowBoundsNormalizer({ screen }) {
    return function normalizeWindowBounds(bounds) {
        const { x: horizontalPosition, y: verticalPosition } = bounds;
        const containingDisplay = screen.getAllDisplays().find(display => {
            const area = display.bounds;
            return area
                && horizontalPosition >= area.x && horizontalPosition < area.x + area.width
                && verticalPosition >= area.y && verticalPosition < area.y + area.height;
        });

        if (!containingDisplay) {
            const nearest = screen.getDisplayNearestPoint({ x: horizontalPosition, y: verticalPosition }).bounds;
            if (nearest) return { x: nearest.x, y: nearest.y };
        }
        return { x: horizontalPosition, y: verticalPosition };
    };
}

module.exports = { createWindowBoundsNormalizer };
