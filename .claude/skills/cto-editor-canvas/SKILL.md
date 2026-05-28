---
name: cto-editor-canvas
description: Use when modifying the CTO/POP diagram editor canvas in ftthplanner — components/CTOEditor.tsx, anything in components/editor/, or related drag/rotation/connection rendering. Captures architecture, coordinate spaces, drag system, cache invalidation rules, and the bugs that hit hard if you skip them.
---

# CTO Editor Canvas

You are about to touch the diagram editor canvas (`components/CTOEditor.tsx`, 4400+ lines, plus `components/editor/*`). It is one of the most complex files in the codebase — high cohesion with subtle invariants. Read this skill before changing drag interactions, rotation, port/connection rendering, or adding new element types or tool modes. Skipping it means rediscovering bugs the codebase already knows about (and that were already fixed once).

## 1. Files that work together

| File | Role |
|---|---|
| `components/CTOEditor.tsx` | Main component. Owns `dragState`, `viewState`, `portCenterCache`, all element/port/connection handlers, `localCTO` state |
| `components/editor/CTOEditorToolbar.tsx` | Top toolbar (rotate / mirror / VFL / OTDR / smart align / delete / fusion / etc.) — only sets tool-mode booleans, never mutates the diagram |
| `components/editor/CableRenderer.tsx` | Renders the row of incoming cables. Memoized |
| `components/editor/FiberCableNode.tsx` | Single cable element (header + fiber port column). Has its own hover-floating rotate/mirror controls |
| `components/editor/SplitterRenderer.tsx`, `SplitterNode.tsx` | Splitters |
| `components/editor/FusionRenderer.tsx`, `FusionNode.tsx` | Fusion points |
| `components/editor/DIORenderer.tsx`, `DIONode.tsx` | DIO bays |
| `components/editor/NotesLayer.tsx` | Sticky notes |

Anything you add (new element type, new tool) needs to be threaded through CTOEditor + a renderer + a node component, following the existing pattern.

## 2. Coordinate spaces — get this wrong and everything is wrong

There are three coordinate systems. Mixing them up is the #1 source of "off by a constant" bugs.

| Space | Source | Used for |
|---|---|---|
| **Screen** | `e.clientX`, `e.clientY`, `getBoundingClientRect()` | Raw mouse events |
| **Container** | screen minus `containerRect.left/top` | Intermediate only |
| **Canvas** | container minus `viewState.x/y`, divided by `viewState.zoom` | Everything stored in state: `layout.x/y`, `conn.points[].x/y`, `getPortCenter()` return value |

Conversion: `screenToCanvas(clientX, clientY)` is the helper. Use it. Don't reinvent.

Inverse (canvas → screen): `canvasX * viewState.zoom + viewState.x + containerRect.left`.

When reading from DOM via `getBoundingClientRect()`, you're in screen space — must convert to canvas before storing or comparing with state.

## 3. Element layout

Every positionable element (cable / splitter / fusion / DIO / note) is stored under:

```ts
localCTO.layout[elementId] = { x, y, rotation, mirrored? }
```

- `x, y` are canvas-space top-left of the element.
- `rotation` ∈ {0, 90, 180, 270} (cables collapse 180→0 and 270→90 by flipping `mirrored` instead — see `handleRotateElement`).
- The DOM element has `id={elementId}` and its CSS `transform` is set imperatively or via React to `translate(x, y) rotate(rot)deg`.

When adding a new element type, layout must be added on creation (`initialLayout = { x, y, rotation: 0 }`), and the element's DOM must have the matching `id` so `getPortCenter` and drag handlers can find it.

## 4. Port positions — the cache rules everything

`getPortCenter(portId)` returns canvas-space `{x, y}` of a fiber/splitter/DIO port.

```ts
// Pseudocode of the real implementation (~L1177)
if (portCenterCache.current[portId]) return cached;
const rect = document.getElementById(portId).getBoundingClientRect();
result = { x: (rect.center.x - containerRect.left - viewState.x) / viewState.zoom, ... };
portCenterCache.current[portId] = result;
return result;
```

**The cache is invalidated by ONE useLayoutEffect (~L771):**

```ts
useLayoutEffect(() => {
  portCenterCache.current = {};
  containerRectCache.current = null;
  forceRender(n => n + 1);
}, [incomingCables, localCTO.connections, localCTO.layout, localCTO.splitters, localCTO.fusions, isMaximized, modalSize, isCollapsed]);
```

Rules:

- If you add a new piece of `localCTO` state that affects port positions, **add it to these deps**. Otherwise ports go stale.
- `viewState` (pan/zoom) is intentionally NOT in deps — ports don't move *relative to the canvas* when the camera moves. Don't add it.
- `forceRender` bumps `cacheVersion`, which is what makes `ConnectionsLayer` (memoized) actually re-render — see §6.

## 5. Drag system

`dragState` is the single source of truth for the in-flight interaction:

```ts
type DragMode = 'view' | 'element' | 'connection' | 'point' | 'reconnect' | 'window' | 'note' | 'resize';
```

| Mode | Triggered by | What changes |
|---|---|---|
| `view` | mousedown on canvas background | pan (`viewState.x/y`) |
| `element` | mousedown on cable/splitter/fusion/DIO body | element `layout.x/y` |
| `point` | mousedown on a connection's middle waypoint | `conn.points[idx]` |
| `connection` | drag the whole connection middle | all of `conn.points` |
| `reconnect` | drag a connection endpoint | reroutes to a new port |
| `window` / `resize` | window chrome drag/resize | modal position/size |
| `note` | note drag | note `x/y` |

### The two performance tricks you must respect

**(a) Imperative DOM during mousemove.** `handleMouseMove` runs at ~60 Hz. Calling `setState` on every move = render storm. Instead it writes directly:
- `el.style.transform = translate(${x}px, ${y}px) rotate(${rot}deg)` on the dragged element
- `pathEl.setAttribute('d', '...')` on every connection touching the dragged element
- Refs: `connectionRefs.current[connId]` (SVG path) and `connectionPointRefs.current[connId-idx]` (waypoint circle)

State commit happens once, in `handleMouseUp`.

**(b) `dragPortSnapshot`.** At mousedown, every port position touching the dragged element is captured into `dragPortSnapshot.current[portId]`. During mousemove, connection endpoints are computed as `snapshot + totalDelta` rather than re-reading the DOM. This avoids compounded offsets if anything invalidates the port cache mid-drag.

Read order during drag: `dragPortSnapshot.current[id] || getPortCenter(id)`. Always.

Snapshot is cleared in `handleMouseUp` (`dragPortSnapshot.current = {}`).

## 6. ConnectionsLayer + memoization

`ConnectionsLayer` (~L284) renders one `<path>` per connection. It is `React.memo` with a hand-written `areEqual`:

```ts
return prev.cacheVersion === next.cacheVersion
    && prev.connections === next.connections
    && prev.litConnections === next.litConnections
    && prev.hoveredPortId === next.hoveredPortId
    && prev.dragState === next.dragState
    && prev.isSmartAlignMode === next.isSmartAlignMode
    && prev.isVflToolActive === next.isVflToolActive
    && prev.isOtdrToolActive === next.isOtdrToolActive;
```

If you add a new prop that affects rendering, **update areEqual** or the layer will silently skip re-renders.

`cacheVersion` is the heartbeat that forces re-render after cache invalidation. Without it, even if the cache is cleared, `connections` and other refs may not change and the memo bails out → stale paths.

## 7. The bugs we already fixed (don't reintroduce them)

### Bug A — connections to stale port positions after rotation

**Symptom:** rotate a cable (especially after a drag) and its fiber connections point off into empty space toward where the other end *used to be*.

**Root cause:** Two layers of staleness:
1. `dragPortSnapshot` from a previous drag still has pre-rotation coords (only relevant if drag was active when rotation fired).
2. The `pathEl.setAttribute('d', ...)` writes from mousemove persist in the DOM. On the next React render, if reconciliation thinks `d` is unchanged (because it compares against the previous VDOM, not the actual DOM), it skips the attribute update — your imperative stale value survives.

**Fix pattern** (already in `handleRotateElement` ~L2255):
```ts
requestAnimationFrame(() => {
  portCenterCache.current = {};
  containerRectCache.current = null;
  localCTORef.current.connections.forEach(conn => {
    // for each conn touching the rotated element:
    const p1 = getPortCenter(conn.sourceId);  // reads fresh from rotated DOM
    const p2 = getPortCenter(conn.targetId);
    if (isStickyDragRotate) {
      dragPortSnapshot.current[conn.sourceId] = p1;
      dragPortSnapshot.current[conn.targetId] = p2;
    }
    const pathEl = connectionRefs.current[conn.id];
    if (pathEl) pathEl.setAttribute('d', `M ${p1.x} ${p1.y} … L ${p2.x} ${p2.y}`);  // imperative rewrite bypasses reconciliation
  });
});
```

**The pattern in words:** after any layout mutation that moves ports, schedule a RAF (so the new layout has been committed by React and is visible in the DOM), then (i) wipe caches, (ii) re-read positions, (iii) imperatively rewrite `d` on affected paths.

### Bug B — port cache poisoned by 0,0 when modal is collapsed

`getBoundingClientRect()` returns zeros for `display: none` elements. If the cache is read while the modal is collapsed, every port becomes `(0,0)` and stays cached even after expanding. That's why `isCollapsed` is in the invalidation effect's deps.

### Bug C — `localCTO.dios` not in invalidation deps

Intentional: every DIO add/remove also mutates `localCTO.layout` (each DIO has a layout entry), so the cache already invalidates via the `layout` dep. Including `localCTO.dios` directly would double-invalidate (and worse: the prop-sync code deep-clones the array on every sync, generating new refs constantly). Same logic applies to anything else that always has a layout entry.

### Bug D — sticky-drag rotation lost the mouse anchor

If you rotate while dragging, you want the cable to stay under the cursor. The `handleRotateElement` does this by, in the same callback: reading the live DOM transform of the element, setting that as the new `initialLayout` for the drag, and resetting `startX/startY` to the current mouse position so the next mousemove computes `delta = 0`. Don't simplify this away.

### Bug E — sticky-drag flag from closure was always `false` (regression of Bug A)

**Symptom:** the original Bug A fix worked, then broke again after a refactor that extracted `scheduleConnectionRefresh(elementId, isStickyDrag)` as a helper.

**Root cause:** the call site captured `isStickyDragRotate` in a closure that was set inside a `setDragState(ds => { … isStickyDragRotate = true; … })` updater. The updater ran in React 18's later batch flush — but the helper was called *before* the flush completed. The value passed by parameter was the initial `false`, not the eventual `true`. The closure variable would be `true` by the time the RAF fired, but the parameter had already been copied as a primitive.

**Fix:** don't pass closure-captured flags from inside a `setState` updater. Have the helper detect sticky drag itself from `dragStateRef.current` inside the RAF — the ref is always synchronized via `useLayoutEffect` and reads true state.

**Rule:** when scheduling work from inside a `setState` updater, don't rely on local variables that *other* `setState` updaters in the same batch will mutate. Read from refs instead.

## 8. Patterns for common tasks

### Adding a new tool mode (like VFL/OTDR/SmartAlign)

1. Add `isXxxToolActive` boolean state.
2. Wire button in `CTOEditorToolbar` (props it out).
3. In `handleCableClick` / `handlePortMouseDown` / `handleConnectionClick`, branch on the tool and `return` early so default drag behavior doesn't fire.
4. Disable conflicting interactions in `handleElementDragStart` (it already short-circuits on most tools).
5. Toggle off when ESC fires (see `handleKeyDown` ~L876) and when the tool button is pressed again.
6. If the cursor should change, append `cursor-crosshair` to the canvas container's className.

### Adding a new draggable element type

1. Define layout shape: `{ x, y, rotation, ... }`. Add to `localCTO`.
2. Render with `transform: translate(x, y) rotate(rot)deg` and `id={elementId}` on the root.
3. On mousedown, call into the existing `handleElementDragStart` pattern (snapshot ports, set `dragState`).
4. Add the new state field to the cache-invalidation `useLayoutEffect` deps.
5. Add a rotation handler that follows the same RAF re-snapshot + imperative `d` rewrite pattern.
6. Smoke test: drag, rotate-during-drag, rotate-after-drag, undo, save+reload, collapse+expand.

### Forcing a connection refresh from outside a drag

```ts
requestAnimationFrame(() => {
  portCenterCache.current = {};
  containerRectCache.current = null;
  forceRender(n => n + 1);  // bumps cacheVersion → ConnectionsLayer re-renders
});
```

Use sparingly. The standard `useLayoutEffect` covers nearly every case automatically.

## 9. Anti-patterns

- **Don't `setState` in `handleMouseMove`.** Use imperative DOM updates. The existing handler already proves the pattern works.
- **Don't read `getPortCenter` during a drag without falling back through `dragPortSnapshot`.** Compounded offsets will eat you.
- **Don't add a `useEffect` with `localCTO` as a whole dep.** It changes on every save / undo / drag end. Prefer `localCTO.layout`, `localCTO.connections`, etc.
- **Don't add a new prop to `ConnectionsLayer` without updating its `areEqual`.** Silent stale renders.
- **Don't trust the DOM transform during a drag of an element you didn't start.** The other drag may have written imperative styles that React won't have overwritten yet. Read from state (`localCTO.layout[id]`) or refs.
- **Don't reorder the dependencies of the cache-invalidation `useLayoutEffect` by hand.** Add new deps to the end and comment why.

## 10. Quick reference (line numbers approximate)

| Need | Where |
|---|---|
| `DragMode` type | `components/CTOEditor.tsx` ~L256 |
| `portCenterCache` ref | ~L1168 |
| `dragPortSnapshot` ref | ~L1174 |
| `getPortCenter` impl | ~L1177 |
| Cache-invalidation `useLayoutEffect` | ~L771 |
| `cacheVersion` / `forceRender` | ~L769 |
| `handleElementDragStart` | ~L1881 area (search for `mode: 'element'` in setDragState) |
| Main `handleMouseMove` | search `dragState.mode === 'element'` ~L2495 |
| `handleMouseUp` | ~L2703 |
| `handleRotateElement` | ~L2213 |
| `handleCableClick` (rotate-mode branch) | ~L2182 |
| `screenToCanvas` helper | search definition |
| `ConnectionsLayer` + `areEqual` | ~L284–L396 |

## 11. Before you commit

Self-check checklist when changing anything in the canvas:

- [ ] Coordinates: did I keep screen/container/canvas spaces straight?
- [ ] Cache deps: if I added state that moves ports, is it in the `useLayoutEffect` deps?
- [ ] Memo: did I add a prop to `ConnectionsLayer` (or another memoized layer)? Updated `areEqual`?
- [ ] Drag-then-action: tested rotate / mirror / smart-align both DURING a drag and right after?
- [ ] Collapse: does the editor still behave when collapsed and re-expanded?
- [ ] Undo/redo: does my change survive a save + reload?
- [ ] Performance: any new `setState` inside `handleMouseMove`? (There shouldn't be.)
