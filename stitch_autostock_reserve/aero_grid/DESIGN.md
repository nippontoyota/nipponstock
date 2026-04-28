# Design System Document: Kinetic Precision

## 1. Overview & Creative North Star
**Creative North Star: The Velocity Cockpit**
This design system is engineered for high-stakes automotive environments where milliseconds matter. It moves away from the "static dashboard" trope, embracing a "Kinetic Precision" aesthetic—an editorial approach to data that feels live, urgent, and authoritative. 

We break the standard grid-container mold by utilizing intentional asymmetry and tonal depth. Rather than using boxes to contain information, we use "speed lanes" of content and layered surfaces that mimic the head-up display (HUD) of a high-performance vehicle. The interface doesn't just sit there; it vibrates with potential energy, organized through sophisticated typography and a hierarchy of light rather than lines.

---

## 2. Colors & Surface Architecture
The color palette is rooted in deep obsidian tones with high-frequency accents designed to draw the eye to critical telemetry data.

*   **Primary Accent (Electric Blue):** Use `primary` (#b8c3ff) and `primary_container` (#2e5bff) for high-performance CTAs and active states.
*   **Urgency Accent (Racing Red):** Use `tertiary` (#ffb4aa) and `tertiary_container` (#d71a18) for critical alerts, heatmaps, and countdowns.
*   **The "No-Line" Rule:** Under no circumstances are 1px solid borders to be used for sectioning. Structural boundaries must be defined solely through background shifts. For example, a global navigation rail should use `surface_container_low` against the `surface` background.
*   **Surface Hierarchy & Nesting:** Treat the UI as a physical stack of materials. 
    *   **Level 0 (Base):** `surface` (#131314)
    *   **Level 1 (Sections):** `surface_container_low` (#1c1b1c)
    *   **Level 2 (Cards/Widgets):** `surface_container` (#201f20)
    *   **Level 3 (Interactive Elements):** `surface_container_high` (#2a2a2b)
*   **The "Glass & Gradient" Rule:** Floating overlays (modals, tooltips, or live telemetry popups) must use `surface_variant` at 60% opacity with a `backdrop-filter: blur(20px)`. Main CTAs should utilize a subtle linear gradient from `primary` to `primary_container` at a 135-degree angle to provide a metallic, high-end finish.

---

## 3. Typography
Typography is the engine of this system. We use a tri-font strategy to balance technical precision with editorial flair.

*   **Display & Headlines (Space Grotesk):** This font provides a technical, futuristic edge. Use `display-lg` and `headline-md` for high-impact data points (e.g., Top Speed, Lap Times). Use tight letter-spacing (-0.02em) for headlines to create a sense of density.
*   **Titles & Body (Manrope):** A high-performance sans-serif designed for legibility at speed. Use `title-lg` for widget headers. All body text should be strictly `body-md` or `body-lg` to ensure readability in low-light environments.
*   **Technical Labels (Inter):** Reserved for small-scale data, micro-labels, and timestamps. `label-sm` should be used for live status badges to maintain a clean, "instrument cluster" feel.

---

## 4. Elevation & Depth
Depth is a functional tool for prioritizing information, not just decoration.

*   **Tonal Layering:** Avoid drop shadows for standard UI components. Instead, place a `surface_container_highest` element on a `surface_container_low` background. The contrast in value creates a "soft lift."
*   **Ambient Shadows:** For floating elements (like a live countdown timer window), use a 24px blur shadow with 8% opacity, using the `on_surface` color as the shadow tint. This mimics natural ambient light hitting a dashboard.
*   **The "Ghost Border":** If a component requires definition against a similar background (e.g., an input field), use the `outline_variant` token at 15% opacity. This creates a perceived edge without breaking the "no-line" aesthetic.
*   **Kinetic Motion:** Elements should "slide" into view using a 300ms "Expedited" easing curve (Cubic Bezier 0.05, 0.7, 0.1, 1). This mimics the acceleration profile of a performance vehicle.

---

## 5. Components

### Buttons
*   **Primary:** Gradient of `primary` to `primary_container`. No border. Corner radius: `md` (0.375rem).
*   **Secondary:** `surface_container_highest` background with `on_surface` text.
*   **Tertiary/Live:** `tertiary_container` with a pulsing opacity animation (100% to 70%) to indicate active "urgent" status.

### Real-Time Data Visualization
*   **Heatmaps:** Use a gradient ramp from `surface_container_highest` (cold) to `primary` (active) to `tertiary` (critical). Avoid harsh grid lines; use a subtle `0.25rem` gap between heatmap cells.
*   **Countdown Timers:** Use `display-sm` (Space Grotesk) with a `tertiary` color. The text should have a subtle outer glow (4px blur) of the same color to simulate an illuminated LED display.
*   **Live Status Badges:** Use `label-md` inside a `full` (9999px) rounded container. For "Live" states, include a 4px circular "on_tertiary" dot that blinks at a 1s interval.

### Cards & Lists
*   **Strict Rule:** No dividers. Separate list items using an `8px` vertical gap.
*   **Hover State:** On hover, a list item should transition from `surface` to `surface_container_low`.
*   **Data Density:** Use `body-sm` for secondary metadata to maximize the amount of information visible on a single screen without clutter.

### Input Fields
*   **Style:** Minimalist. Use `surface_container_lowest` for the field background with a "Ghost Border" that turns `primary` on focus.
*   **Labels:** Always use `label-md` in `on_surface_variant` positioned above the field, never as a placeholder.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical layouts. A 30/70 split for a telemetry sidebar vs. a main map is more "professional" than a 50/50 split.
*   **Do** lean into `surface_container` tiers to create hierarchy.
*   **Do** ensure all "Racing Red" (`tertiary`) elements are reserved for truly urgent data.

### Don't
*   **Don't** use 100% white (#FFFFFF). Use `on_surface` (#e5e2e3) to reduce eye strain in dark environments.
*   **Don't** use standard "drop shadows" or heavy black borders.
*   **Don't** use rounded corners larger than `xl` (0.75rem) for functional containers. This is a precision system, not a consumer social app; overly rounded corners feel too "soft."
*   **Don't** use dividers or "rules" to separate content. Use negative space and color blocks.