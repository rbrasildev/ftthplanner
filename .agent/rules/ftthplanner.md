---
trigger: always_on
---

DO NOT modify existing functionality.
DO NOT refactor, remove, or rewrite working code.
- ALWAYS put the texts in the LanguageContext.
Change ONLY what I explicitly request.

This is a Leaflet-based, performance-critical map system.

All implementations MUST prioritize maximum performance and low memory usage,
especially regarding:
- Markers, polylines, polygons, and layers
- Event listeners and interactions
- Rendering performance (DOM vs Canvas)
- Zoom, pan, and redraw behavior
- API calls and data loading

Performance rules:
- Avoid unnecessary re-renders or map redraws
- Avoid creating or destroying layers repeatedly
- Reuse existing layers and objects when possible
- Minimize event listeners
- Avoid heavy computations during zoom and move events
- Avoid unnecessary API calls

LANGUAGE RULES

- Always explain everything in Portuguese (pt-BR).
- Any technical term, English word, or concept MUST be explained
  in the context of the programming language or technology being used
  (e.g., JavaScript, Leaflet, React, backend, API).
- Do NOT assume prior knowledge of terminology.

Any performance-related change MUST:
- Preserve existing behavior exactly
- Be strictly limited to the requested feature
- Not introduce new dependencies unless explicitly requested

If a requested change impacts existing code, map behavior, or performance,
explain the impact clearly and wait for my confirmation before proceeding.

If there is any uncertainty, ASK before making changes.

CORE PRINCIPLE:
Anything not explicitly requested MUST remain exactly as it is.