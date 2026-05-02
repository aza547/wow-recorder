# Mac Preview Editor Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace DOM orange-box overlays on macOS with OBS-drawn selection UI driven by JS hit-testing + drag math, matching the SLOBS Studio Editor pattern.

**Architecture:** OBS owns the preview NSView (added on top of WebContents via nwr; hitTest pass-through routes events to DOM). A transparent React overlay captures mouse events and forwards `{offsetX, offsetY, button, modifiers}` to a new main-side `EditorService`. EditorService translates DOM-local px → canvas-px via `OBS_content_getDisplayPreviewOffset/Size`, hit-tests scene items, sets `sceneItem.selected = true`, and on drag updates `sceneItem.position/scale`. OBS draws the selection rectangle and transform handles itself via `setShouldDrawUI(true)`.

**Tech Stack:** Electron, obs-studio-node 0.26, React 18, IPC channels (preload), node-window-rendering for the preview NSView.

---

## Status (2026-04-30)

**Blocker discovered:** the vendored `obs-studio-node` (0.26.x, in `release/app/node_modules/obs-studio-node`) does **not** expose `OBS_content_setOutlineColor` to JavaScript even though the native binary contains the symbol.

```
$ strings obs_studio_client.node | grep OBS_content_set
OBS_content_setCropOutlineColor    # bound
OBS_content_setDayTheme            # bound
OBS_content_setDrawGuideLines      # bound
OBS_content_setDrawRotationHandle  # bound
OBS_content_setPaddingColor        # bound
OBS_content_setPaddingSize         # bound
OBS_content_setShouldDrawUI        # bound
OBS_content_setOutlineColor        # NOT bound — string only

$ node -e "const o = require('obs-studio-node'); \
           console.log(Object.keys(o.NodeObs).filter(k => k.startsWith('OBS_content')));"
# 'OBS_content_setOutlineColor' is missing from the array
```

Probe verified at runtime: setting `sceneItem.selected = true` + `OBS_content_setShouldDrawUI(key, true)` produces no visible selection rectangle, because the outline color defaults to 0/transparent and there is no JS-side setter.

`OBS_content_setOutlineColor is not a function` confirmed in logs (2026-04-30 17:57:49 run).

### What this means for the plan

Option 1 as originally written **cannot ship without first patching the JS bindings** in the obs-studio-node Mac fork to expose `setOutlineColor` (and ideally `setOutlineWidth`, `setResizeOuterColors`, `setResizeInnerColors` if they exist). Until that patch lands, libobs draws nothing visible even when `setShouldDrawUI(true)`.

### Updated plan structure

- **Phase A (NEW, prerequisite):** Patch obs-studio-node bindings to expose the missing display setters, rebuild against the Electron ABI, re-vendor.
- **Phase B (was the original plan):** EditorService + IPC + DOM event-capture overlay — runs unchanged once Phase A lands.
- **Phase C (interim fallback if Phase A blocked):** Stick with DOM overlay boxes, audit and fix coord math (`zoomFactor=1` on Mac, sf computed from CSS-px, etc.). Already partially in place. Defer Phase B until OSN can be patched.

The remaining Tasks 1–12 below are Phase B and assume Phase A is done.

---

---

## Phase A — OSN Bindings Patch (prerequisite for Phase B)

**Why:** Phase B's value (OBS-drawn selection rectangle + transform handles, SLOBS pattern) requires `OBS_content_setOutlineColor` to be callable from Node. Without a non-zero outline color, libobs paints nothing visible even with `setShouldDrawUI(true)`.

### Diagnosis (2026-04-30)

OSN source lives at `https://github.com/stream-labs/obs-studio-node`. We have a local clone at `/Users/yuripiratello/projects/personal/obs-studio-node`. The shipped binary is fetched from `https://s3-us-west-2.amazonaws.com/obsstudionodes3.streamlabs.com/osn-0.26.17-release-osx-arm64.tar.gz` (see `release/app/package.json`).

In `obs-studio-client/source/nodeobs_display.cpp`:

```cpp
// Line 248: implementation EXISTS
Napi::Value display::OBS_content_setOutlineColor(const Napi::CallbackInfo &info) {
    ...
    conn->call("Display", "OBS_content_setOutlineColor", {ipc::value(key), ...});
    ...
}

// Line 343-358: registration block — only THESE are registered:
exports.Set("OBS_content_setDayTheme",            ...);
exports.Set("OBS_content_createDisplay",          ...);
exports.Set("OBS_content_destroyDisplay",         ...);
exports.Set("OBS_content_getDisplayPreviewOffset",...);
exports.Set("OBS_content_getDisplayPreviewSize",  ...);
exports.Set("OBS_content_createSourcePreviewDisplay", ...);
exports.Set("OBS_content_resizeDisplay",          ...);
exports.Set("OBS_content_moveDisplay",            ...);
exports.Set("OBS_content_setPaddingSize",         ...);
exports.Set("OBS_content_setPaddingColor",        ...);
exports.Set("OBS_content_setCropOutlineColor",    ...);  // <- crop outline IS registered
exports.Set("OBS_content_setShouldDrawUI",        ...);
exports.Set("OBS_content_setDrawGuideLines",      ...);
exports.Set("OBS_content_setDrawRotationHandle",  ...);
exports.Set("OBS_content_createIOSurface",        ...);
// NOTE: setOutlineColor is implemented but NOT registered.
```

This is upstream's bug — most likely an oversight when the function was added but never exported. The native binary contains the symbol (`strings obs_studio_client.node | grep setOutlineColor` matches), the function compiles, but JS callers can never reach it.

### Fix

Add a single line in `obs-studio-client/source/nodeobs_display.cpp` between `setPaddingColor` and `setCropOutlineColor`:

```cpp
exports.Set(Napi::String::New(env, "OBS_content_setOutlineColor"),
            Napi::Function::New(env, display::OBS_content_setOutlineColor));
```

Then rebuild OSN, package the resulting `.node` + dylibs into a tarball matching the layout of `osn-0.26.17-release-osx-arm64.tar.gz`, point `release/app/package.json:optionalDependencies.obs-studio-node` at the new tarball URL (or a local file path during dev).

### Tasks

#### A1: Confirm clone is at the right commit

- [ ] **Step 1:** `cd /Users/yuripiratello/projects/personal/obs-studio-node && git status` — note the current branch / SHA.
- [ ] **Step 2:** Compare against the SHA the shipped 0.26.17 tarball was built from. If unknown, check whether the registration block in `obs-studio-client/source/nodeobs_display.cpp` matches the omission described above (it does, as of 2026-04-30 on whichever branch we're on).
- [ ] **Step 3:** Decide: branch off current HEAD, or check out a tag closer to 0.26.17. The patch is mechanical either way; safer to base on the tagged release we already ship to minimize unrelated diffs.

#### A2: Apply the registration patch

- [ ] **Step 1:** Edit `obs-studio-client/source/nodeobs_display.cpp` line ~353. Add the `exports.Set` line shown above.
- [ ] **Step 2:** Commit on a `wcr-mac-outline-color` branch.
  ```bash
  cd /Users/yuripiratello/projects/personal/obs-studio-node
  git checkout -b wcr-mac-outline-color
  git add obs-studio-client/source/nodeobs_display.cpp
  git commit -m "fix(display): register OBS_content_setOutlineColor JS binding"
  ```

#### A3: Build OSN locally for macOS arm64

- [ ] **Step 1:** Read `obs-studio-node/CONTRIBUTING.md` and `ci/` scripts for the supported macOS build flow. The repo uses CMake + cmake-js. Likely roughly:
  ```bash
  cd /Users/yuripiratello/projects/personal/obs-studio-node
  yarn install
  cmake -B build -G Xcode -DCMAKE_OSX_ARCHITECTURES=arm64 -DCMAKE_INSTALL_PREFIX=./distribute
  cmake --build build --target install --config Release
  ```
- [ ] **Step 2:** Resolve missing dependencies as they come up. libobs prebuilt typically ships with the repo (or via submodule); CEF, FFmpeg, x264 dylibs likewise.
- [ ] **Step 3:** Output should land in `distribute/` matching the layout of the shipped tarball:
  ```
  distribute/obs-studio-node/
    obs_studio_client.node
    obs_studio_client.<version>.node
    bin/obs64
    Frameworks/...
    data/...
    module.ts, module.d.ts, etc.
  ```

#### A4: Rebuild .node against Electron 38.1.2 ABI

- [ ] **Step 1:** OSN ships its native binary built against system Node ABI by default. We need it against the Electron Node ABI (currently 38.1.2 / Node 22.x). Use `electron-rebuild` against the produced `.node`, or pass `--runtime=electron --target=38.1.2 --abi=...` to `cmake-js` during the build. Mirror what we do for `uiohook-napi` in the `prerebuild` step.
- [ ] **Step 2:** Verify ABI match:
  ```bash
  otool -L distribute/obs-studio-node/obs_studio_client.node | head
  file distribute/obs-studio-node/obs_studio_client.node
  ```

#### A5: Re-vendor + verify the binding

- [ ] **Step 1:** Replace `release/app/node_modules/obs-studio-node/obs_studio_client.node` (and any sibling versioned copies) with the rebuilt artifact. Optionally tar up `distribute/obs-studio-node` and host it; then bump `release/app/package.json:optionalDependencies.obs-studio-node` to the new URL.
- [ ] **Step 2:** Smoke test the JS binding (no OBS init needed for the property check):
  ```bash
  node -e "const o = require('./release/app/node_modules/obs-studio-node'); \
           console.log(Object.keys(o.NodeObs).filter(k => k.includes('setOutlineColor')));"
  # expected: [ 'OBS_content_setOutlineColor' ]
  ```
- [ ] **Step 3:** Re-run our packaging steps (`relativise-osn`, `sign-osn-binaries.js`) so the new `.node` ends up signed inside the .app.

#### A6: End-to-end visual check

- [ ] **Step 1:** Temporarily re-add probe in `OsnBackend.showPreview`:
  ```ts
  osn.NodeObs.OBS_content_setShouldDrawUI(this.previewKey, true);
  osn.NodeObs.OBS_content_setOutlineColor(this.previewKey, 251, 117, 47, 255);
  osn.NodeObs.OBS_content_setCropOutlineColor(this.previewKey, 0, 255, 0, 255);
  osn.NodeObs.OBS_content_setDrawGuideLines(this.previewKey, true);
  osn.NodeObs.OBS_content_setDrawRotationHandle(this.previewKey, true);
  // Programmatically select topmost item:
  const items = this.scene?.getItems() ?? [];
  if (items.length) items[items.length - 1].selected = true;
  ```
- [ ] **Step 2:** Repackage + run via `./scripts/dev-launch.sh`.
- [ ] **Step 3:** Expect a bright orange selection rectangle drawn by libobs around the topmost scene item, with corner resize handles + rotation handle. Snapshot it and compare against SLOBS for parity.
- [ ] **Step 4:** If visible: remove probe, proceed to Phase B (Tasks 1–12 below). If still not visible: investigate libobs-side rendering (the C++ function may itself be a no-op on macOS in this OSN/libobs version — check the server-side counterpart in `obs-studio-server/source/nodeobs_display.cpp`).

#### A7: Upstream + maintenance

- [ ] **Step 1:** Open a PR against `stream-labs/obs-studio-node` with the one-line registration fix, so we don't carry a fork forever.
- [ ] **Step 2:** Until the PR is merged + Streamlabs ships a new tarball, our `release/app/package.json` points at our local build (private S3 / GitHub Release / file:// dev path).

### Fallback if Phase A is infeasible

- [ ] If the OSN build chain blocks us (libobs deps, signing, codesign edge cases, Cocoa SDK mismatch), document the limitation in `docs/macos-port.md` and accept that on macOS the orange placeholder rectangles stay in DOM, with the visibility caveat that they sit behind the OpenGL preview NSView. Phase B is gated on Phase A.

---

## File Structure (Phase B)

**Create:**
- `src/main/EditorService.ts` — new main-side singleton owning selection + drag/resize state.
- `src/renderer/MacPreviewOverlay.tsx` — Mac-only transparent event-capture div.
- `src/main/__tests__/EditorService.test.ts` — JS hit-test + drag math unit tests.

**Modify:**
- `src/main/platform/recorder/OsnBackend.ts` — `setShouldDrawUI(true)` on Mac; add `getCanvasInfo()`, `getPreviewLayout()`, `setSceneItemSelected()`, `setSceneItemPosition()`, `setSceneItemScale()`, `getSceneItemBounds()`.
- `src/main/platform/recorder/IRecorderBackend.ts` — extend interface with new editor primitives (no-op stubs on NoobsBackend Windows path).
- `src/main/preload.ts` — IPC channels: `editor:mouseDown`, `editor:mouseMove`, `editor:mouseUp`, `editor:mouseWheel`, `editor:contextMenu`, `editor:dblClick`, `editor:cursor` (renderer→main); `editor:cursorChanged` (main→renderer).
- `src/renderer/preload.d.ts` — add channel types.
- `src/renderer/RecorderPreview.tsx` — Mac branch: render `<MacPreviewOverlay />` instead of `renderDraggableSceneBox` calls.
- `src/main/Recorder.ts` — wire `EditorService.setBackend()` after `initializeObs()`.

**Out of scope (Mac MVP):**
- Crop adjustment (chatOverlayCropX/Y) — keep existing slider UI, no editor-driven cropping.
- Multi-select.
- Source rotation.
- Snap-to-edge (re-add post-MVP via JS).

---

## Phase C — DOM Overlay Coord Audit (interim fallback, current path)

If Phase A is blocked, this is what ships. The DOM orange boxes already exist; they just need coord math that doesn't double-count DPR on Mac.

### C1: `zoomFactor = 1` on Mac in RecorderPreview

**Status:** done 2026-04-30. Three call sites in `src/renderer/RecorderPreview.tsx` (`onSourceMove`, `onSourceScale`, `renderDraggableSceneBox`) now branch on `window.platformInfo?.platform === 'darwin'`.

### C2: Verify `getSourcePosition` math under CSS-px regime

`Recorder.getSourcePosition` computes `sf = previewWidth / canvasWidth`. On Mac, `previewWidth` is now CSS-px (per the SLOBS-style configurePreview), so `sf` is `CSS-px / canvas-px`. Returned `current.x * sf` is CSS-px. DOM consumes directly with `zoomFactor = 1`. **Confirm by reading**: `src/main/Recorder.ts:1578-1611`.

### C3: Open issues to chase if boxes still misaligned

- [ ] Confirm `cachedPreviewDimensions.previewWidth/Height` in `OsnBackend` matches the CSS-px values the renderer sent in `configurePreview`. Add a temporary log in `getPreviewInfo()` if needed.
- [ ] `xCorr` / `yCorr` letterbox math in `RecorderPreview.tsx:122-133` assumes preview AND canvas in same unit system — should hold on Mac if all are CSS-px.
- [ ] Inspect `event.movementX` units: on Mac WebKit, `movementX` is CSS-px. With `zoomFactor=1`, `prev.x + movementX` adds CSS-px to a CSS-px value. ✓

### C4: If still off after audit

- [ ] Add a debug overlay div that draws OBS canvas bounds + each scene-item bbox in CSS-px so we can eyeball misalignment without needing the OBS GL surface.
- [ ] Compare against the current Windows behavior side-by-side; write down the exact numeric expectation, then log the actual numbers and diff.

---

## Phase B Tasks (require Phase A complete)

### Task 1: Probe `setShouldDrawUI` actually paints selection

**Files:**
- Modify: `src/main/platform/recorder/OsnBackend.ts:822` (showPreview step 3)

- [ ] **Step 1: Flip `setShouldDrawUI` to true and select a scene item programmatically**

In `showPreview`, change:
```ts
osn.NodeObs.OBS_content_setShouldDrawUI(this.previewKey, false);
```
to:
```ts
osn.NodeObs.OBS_content_setShouldDrawUI(this.previewKey, true);
```

Then in a temporary debug method, after the preview is shown, mark the game source selected:
```ts
const scene = osn.SceneFactory.fromName(this.sceneName);
const item = scene.findItem(SceneItem.GAME);
if (item) item.selected = true;
```

- [ ] **Step 2: Repackage + run dev-launch.sh**

```bash
WCR_SIGN_IDENTITY="Developer ID Application: Yuri Piratello (Y36BG56F47)" npm run package
./scripts/dev-launch.sh
```
Expected: red/orange OBS selection rectangle drawn around the game source inside the preview canvas. If nothing visible, check OBS log for "Failed to find scene item" or similar.

- [ ] **Step 3: Revert temp debug selection, leave `setShouldDrawUI(true)` permanent**

- [ ] **Step 4: Commit**

```bash
git add src/main/platform/recorder/OsnBackend.ts
git commit -m "feat(macos): enable OBS-drawn selection UI in preview"
```

---

### Task 2: `getPreviewLayout` + `getCanvasInfo` on OsnBackend

Renderer needs preview-rect → canvas-px conversion math. OSN exposes `OBS_content_getDisplayPreviewOffset/Size`, which returns the letterboxed canvas region inside the view frame.

**Files:**
- Modify: `src/main/platform/recorder/OsnBackend.ts`
- Modify: `src/main/platform/recorder/IRecorderBackend.ts`

- [ ] **Step 1: Extend backend interface**

In `IRecorderBackend.ts`:
```ts
export interface PreviewLayout {
  offsetX: number; // letterbox offset in view-local px
  offsetY: number;
  width: number;  // letterboxed canvas region size
  height: number;
}

export interface CanvasInfo {
  width: number;
  height: number;
}

export interface IRecorderBackend {
  // ... existing
  getPreviewLayout(): PreviewLayout;
  getCanvasInfo(): CanvasInfo;
}
```

- [ ] **Step 2: Implement on OsnBackend**

```ts
getPreviewLayout(): PreviewLayout {
  const osn = this.getOsn();
  const offset = osn.NodeObs.OBS_content_getDisplayPreviewOffset(this.previewKey);
  const size = osn.NodeObs.OBS_content_getDisplayPreviewSize(this.previewKey);
  return {
    offsetX: offset.x,
    offsetY: offset.y,
    width: size.width,
    height: size.height,
  };
}

getCanvasInfo(): CanvasInfo {
  return { width: this.videoWidth, height: this.videoHeight };
}
```

- [ ] **Step 3: NoobsBackend stubs**

In `NoobsBackend.ts`:
```ts
getPreviewLayout(): PreviewLayout { return { offsetX: 0, offsetY: 0, width: 0, height: 0 }; }
getCanvasInfo(): CanvasInfo { return { width: 0, height: 0 }; }
```

- [ ] **Step 4: Commit**

```bash
git add src/main/platform/recorder/
git commit -m "feat(macos): expose preview layout + canvas info on backend"
```

---

### Task 3: Backend scene-item primitives

EditorService needs to read item bounds and write position/scale. Add backend-level wrappers so the editor never imports OSN directly.

**Files:**
- Modify: `src/main/platform/recorder/OsnBackend.ts`
- Modify: `src/main/platform/recorder/IRecorderBackend.ts`

- [ ] **Step 1: Extend interface**

```ts
export interface SceneItemBounds {
  x: number;       // canvas-px top-left
  y: number;
  width: number;   // scaled width in canvas-px
  height: number;
  scaleX: number;
  scaleY: number;
  sourceWidth: number;  // raw source width
  sourceHeight: number;
}

export interface IRecorderBackend {
  getSceneItemBounds(sceneItem: string): SceneItemBounds | undefined;
  setSceneItemSelected(sceneItem: string, selected: boolean): void;
  clearSceneItemSelection(): void;
  setSceneItemPosition(sceneItem: string, x: number, y: number): void;
  setSceneItemScale(sceneItem: string, scaleX: number, scaleY: number): void;
  listSceneItems(): string[]; // top-most last (z-order)
}
```

- [ ] **Step 2: Implement on OsnBackend**

```ts
private findItem(name: string) {
  const osn = this.getOsn();
  const scene = osn.SceneFactory.fromName(this.sceneName);
  return scene?.findItem(name);
}

getSceneItemBounds(name: string): SceneItemBounds | undefined {
  const item = this.findItem(name);
  if (!item) return undefined;
  const src = item.source;
  return {
    x: item.position.x,
    y: item.position.y,
    width: src.width * item.scale.x,
    height: src.height * item.scale.y,
    scaleX: item.scale.x,
    scaleY: item.scale.y,
    sourceWidth: src.width,
    sourceHeight: src.height,
  };
}

setSceneItemSelected(name: string, selected: boolean): void {
  const item = this.findItem(name);
  if (item) item.selected = selected;
}

clearSceneItemSelection(): void {
  const osn = this.getOsn();
  const scene = osn.SceneFactory.fromName(this.sceneName);
  if (!scene) return;
  scene.getItems().forEach((it) => { it.selected = false; });
}

setSceneItemPosition(name: string, x: number, y: number): void {
  const item = this.findItem(name);
  if (item) item.position = { x, y };
}

setSceneItemScale(name: string, sx: number, sy: number): void {
  const item = this.findItem(name);
  if (item) item.scale = { x: sx, y: sy };
}

listSceneItems(): string[] {
  const osn = this.getOsn();
  const scene = osn.SceneFactory.fromName(this.sceneName);
  if (!scene) return [];
  // OSN scene.getItems() returns bottom-up; topmost rendered last in OBS.
  return scene.getItems().map((it) => it.source.name);
}
```

- [ ] **Step 3: NoobsBackend stubs returning undefined / no-ops**

- [ ] **Step 4: Commit**

```bash
git add src/main/platform/recorder/
git commit -m "feat(macos): scene-item primitives for editor service"
```

---

### Task 4: `EditorService` — coord translation + hit testing

**Files:**
- Create: `src/main/EditorService.ts`
- Create: `src/main/__tests__/EditorService.test.ts`

- [ ] **Step 1: Write failing test for coord translation**

In `EditorService.test.ts`:
```ts
import EditorService from '../EditorService';

describe('EditorService.viewToCanvas', () => {
  it('maps view-local px through letterbox offset to canvas px', () => {
    const svc = new EditorService();
    svc._setLayoutForTest(
      { offsetX: 10, offsetY: 20, width: 800, height: 450 },
      { width: 1920, height: 1080 },
    );
    expect(svc.viewToCanvas(10, 20)).toEqual({ x: 0, y: 0 });
    expect(svc.viewToCanvas(810, 470)).toEqual({ x: 1920, y: 1080 });
    expect(svc.viewToCanvas(410, 245)).toEqual({ x: 960, y: 540 });
  });
  it('returns null when point falls in letterbox bars', () => {
    const svc = new EditorService();
    svc._setLayoutForTest(
      { offsetX: 10, offsetY: 20, width: 800, height: 450 },
      { width: 1920, height: 1080 },
    );
    expect(svc.viewToCanvas(5, 100)).toBeNull();
    expect(svc.viewToCanvas(900, 100)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, expect FAIL ("Cannot find module '../EditorService'")**

```bash
npx jest src/main/__tests__/EditorService.test.ts
```

- [ ] **Step 3: Implement minimal EditorService**

```ts
import type {
  PreviewLayout,
  CanvasInfo,
  SceneItemBounds,
  IRecorderBackend,
} from './platform/recorder/IRecorderBackend';

export interface EditorMouseEvent {
  offsetX: number; // view-local px (relative to preview NSView frame)
  offsetY: number;
  button: number;  // 0 left, 1 middle, 2 right
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
}

interface CanvasPoint { x: number; y: number; }

export default class EditorService {
  private static instance: EditorService;
  private backend: IRecorderBackend | undefined;
  private layoutOverride: PreviewLayout | undefined;
  private canvasOverride: CanvasInfo | undefined;
  private dragState:
    | { kind: 'move'; name: string; startCanvas: CanvasPoint; startPos: { x: number; y: number } }
    | { kind: 'resize'; name: string; corner: 'tl' | 'tr' | 'bl' | 'br'; startCanvas: CanvasPoint; startBounds: SceneItemBounds }
    | undefined;
  private selectedName: string | undefined;

  static getInstance(): EditorService {
    if (!EditorService.instance) EditorService.instance = new EditorService();
    return EditorService.instance;
  }

  setBackend(backend: IRecorderBackend) { this.backend = backend; }

  /** Test-only injection. */
  _setLayoutForTest(layout: PreviewLayout, canvas: CanvasInfo) {
    this.layoutOverride = layout;
    this.canvasOverride = canvas;
  }

  private layout(): PreviewLayout {
    return this.layoutOverride ?? this.backend!.getPreviewLayout();
  }
  private canvas(): CanvasInfo {
    return this.canvasOverride ?? this.backend!.getCanvasInfo();
  }

  viewToCanvas(vx: number, vy: number): CanvasPoint | null {
    const L = this.layout();
    const C = this.canvas();
    if (vx < L.offsetX || vy < L.offsetY) return null;
    if (vx > L.offsetX + L.width || vy > L.offsetY + L.height) return null;
    const fx = (vx - L.offsetX) / L.width;
    const fy = (vy - L.offsetY) / L.height;
    return { x: fx * C.width, y: fy * C.height };
  }
}
```

- [ ] **Step 4: Re-run test, expect PASS**

```bash
npx jest src/main/__tests__/EditorService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/main/EditorService.ts src/main/__tests__/EditorService.test.ts
git commit -m "feat(macos): EditorService with view→canvas coord math"
```

---

### Task 5: Hit-test + selection on mouseDown

**Files:**
- Modify: `src/main/EditorService.ts`
- Modify: `src/main/__tests__/EditorService.test.ts`

- [ ] **Step 1: Write failing test for hit-test**

```ts
describe('EditorService.handleMouseDown', () => {
  it('selects topmost item under canvas point', () => {
    const svc = new EditorService();
    svc._setLayoutForTest(
      { offsetX: 0, offsetY: 0, width: 1920, height: 1080 },
      { width: 1920, height: 1080 },
    );
    const calls: Array<[string, boolean]> = [];
    svc._setBackendStub({
      listSceneItems: () => ['bg', 'overlay'], // overlay topmost
      getSceneItemBounds: (n) => n === 'bg'
        ? { x: 0, y: 0, width: 1920, height: 1080, scaleX: 1, scaleY: 1, sourceWidth: 1920, sourceHeight: 1080 }
        : { x: 100, y: 100, width: 200, height: 100, scaleX: 1, scaleY: 1, sourceWidth: 200, sourceHeight: 100 },
      setSceneItemSelected: (n, s) => calls.push([n, s]),
      clearSceneItemSelection: () => {},
    });
    svc.handleMouseDown({ offsetX: 150, offsetY: 130, button: 0, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false });
    expect(calls).toEqual([['overlay', true]]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
_setBackendStub(stub: any) { this.backend = stub; }

handleMouseDown(ev: EditorMouseEvent): void {
  const pt = this.viewToCanvas(ev.offsetX, ev.offsetY);
  if (!pt) return;
  const items = this.backend!.listSceneItems();
  // top-down: last in list is topmost
  for (let i = items.length - 1; i >= 0; i -= 1) {
    const name = items[i];
    const b = this.backend!.getSceneItemBounds(name);
    if (!b) continue;
    if (pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height) {
      this.backend!.clearSceneItemSelection();
      this.backend!.setSceneItemSelected(name, true);
      this.selectedName = name;
      this.dragState = {
        kind: 'move',
        name,
        startCanvas: pt,
        startPos: { x: b.x, y: b.y },
      };
      return;
    }
  }
  this.backend!.clearSceneItemSelection();
  this.selectedName = undefined;
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/main/EditorService.ts src/main/__tests__/EditorService.test.ts
git commit -m "feat(macos): mouseDown selects topmost scene item"
```

---

### Task 6: Drag-to-move

**Files:**
- Modify: `src/main/EditorService.ts`
- Modify: `src/main/__tests__/EditorService.test.ts`

- [ ] **Step 1: Write failing test**

```ts
it('moves selected item by canvas-px delta during drag', () => {
  const svc = new EditorService();
  svc._setLayoutForTest(
    { offsetX: 0, offsetY: 0, width: 1920, height: 1080 },
    { width: 1920, height: 1080 },
  );
  const moves: Array<[string, number, number]> = [];
  svc._setBackendStub({
    listSceneItems: () => ['game'],
    getSceneItemBounds: () => ({ x: 100, y: 200, width: 400, height: 300, scaleX: 1, scaleY: 1, sourceWidth: 400, sourceHeight: 300 }),
    setSceneItemSelected: () => {},
    clearSceneItemSelection: () => {},
    setSceneItemPosition: (n, x, y) => moves.push([n, x, y]),
  });
  svc.handleMouseDown({ offsetX: 150, offsetY: 250, button: 0, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false });
  svc.handleMouseMove({ offsetX: 200, offsetY: 280, button: 0, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false });
  expect(moves).toEqual([['game', 150, 230]]);
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `handleMouseMove`**

```ts
handleMouseMove(ev: EditorMouseEvent): void {
  if (!this.dragState) return;
  const pt = this.viewToCanvas(ev.offsetX, ev.offsetY);
  if (!pt) return;
  if (this.dragState.kind === 'move') {
    const dx = pt.x - this.dragState.startCanvas.x;
    const dy = pt.y - this.dragState.startCanvas.y;
    this.backend!.setSceneItemPosition(
      this.dragState.name,
      this.dragState.startPos.x + dx,
      this.dragState.startPos.y + dy,
    );
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(macos): drag-to-move selected scene item"
```

---

### Task 7: handleMouseUp + persist position

**Files:**
- Modify: `src/main/EditorService.ts`
- Modify: `src/main/__tests__/EditorService.test.ts`

- [ ] **Step 1: Write failing test**

Verify `handleMouseUp` clears `dragState` AND emits a "position-committed" event the caller can subscribe to (so `Recorder.ts` can persist to ConfigService).

```ts
it('emits committed event on mouseUp with final canvas position', () => {
  const svc = new EditorService();
  svc._setLayoutForTest(
    { offsetX: 0, offsetY: 0, width: 1920, height: 1080 },
    { width: 1920, height: 1080 },
  );
  svc._setBackendStub({
    listSceneItems: () => ['game'],
    getSceneItemBounds: () => ({ x: 100, y: 200, width: 400, height: 300, scaleX: 0.5, scaleY: 0.5, sourceWidth: 800, sourceHeight: 600 }),
    setSceneItemSelected: () => {},
    clearSceneItemSelection: () => {},
    setSceneItemPosition: () => {},
  });
  const committed: Array<{ name: string; x: number; y: number; scaleX: number; scaleY: number }> = [];
  svc.onCommit((c) => committed.push(c));
  svc.handleMouseDown({ offsetX: 150, offsetY: 250, button: 0, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false });
  svc.handleMouseMove({ offsetX: 200, offsetY: 280, button: 0, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false });
  svc.handleMouseUp({ offsetX: 200, offsetY: 280, button: 0, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false });
  expect(committed).toEqual([{ name: 'game', x: 150, y: 230, scaleX: 0.5, scaleY: 0.5 }]);
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
private commitListeners: Array<(c: { name: string; x: number; y: number; scaleX: number; scaleY: number }) => void> = [];

onCommit(cb: (c: { name: string; x: number; y: number; scaleX: number; scaleY: number }) => void) {
  this.commitListeners.push(cb);
}

handleMouseUp(_ev: EditorMouseEvent): void {
  if (!this.dragState) return;
  const name = this.dragState.name;
  const b = this.backend!.getSceneItemBounds(name);
  this.dragState = undefined;
  if (!b) return;
  this.commitListeners.forEach((cb) =>
    cb({ name, x: b.x, y: b.y, scaleX: b.scaleX, scaleY: b.scaleY }),
  );
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(macos): commit final position on mouseUp"
```

---

### Task 8: Resize handles (corner regions)

**Files:**
- Modify: `src/main/EditorService.ts`
- Modify: `src/main/__tests__/EditorService.test.ts`

- [ ] **Step 1: Write failing test for hit-detection of corner handles**

```ts
it('detects br corner resize when click within HANDLE_PX of bottom-right', () => {
  const svc = new EditorService();
  svc._setLayoutForTest(
    { offsetX: 0, offsetY: 0, width: 1920, height: 1080 },
    { width: 1920, height: 1080 },
  );
  let resizing: string | undefined;
  svc._setBackendStub({
    listSceneItems: () => ['game'],
    getSceneItemBounds: () => ({ x: 100, y: 200, width: 400, height: 300, scaleX: 1, scaleY: 1, sourceWidth: 400, sourceHeight: 300 }),
    setSceneItemSelected: () => {},
    clearSceneItemSelection: () => {},
    setSceneItemScale: () => { resizing = 'game'; },
    setSceneItemPosition: () => {},
  });
  svc.handleMouseDown({ offsetX: 498, offsetY: 498, button: 0, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false });
  svc.handleMouseMove({ offsetX: 600, offsetY: 600, button: 0, altKey: false, shiftKey: false, metaKey: false, ctrlKey: false });
  expect(resizing).toBe('game');
});
```

- [ ] **Step 2: Implement HANDLE_PX hit-test in `handleMouseDown`**

In canvas-px space, define `HANDLE_PX = 12` (enlarged for usability). For each item, check if `pt` is within HANDLE_PX of one of the four corners; if yes set `dragState = { kind: 'resize', corner, startCanvas, startBounds }` and skip selection.

In `handleMouseMove`, on resize state: compute new size, divide by `sourceWidth/Height` for scale, call `setSceneItemScale`. For non-`br` corners, also update `setSceneItemPosition` so the opposite corner stays anchored.

- [ ] **Step 3: Run, expect PASS**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(macos): corner resize handles"
```

---

### Task 9: IPC plumbing + preload

**Files:**
- Modify: `src/main/preload.ts`
- Modify: `src/renderer/preload.d.ts`
- Modify: `src/main/Recorder.ts` (or new bridge file)

- [ ] **Step 1: Add channels**

In `preload.ts`, extend `Channels` union:
```ts
| 'editor:mouseDown'
| 'editor:mouseMove'
| 'editor:mouseUp'
| 'editor:dblClick'
| 'editor:contextMenu'
```

Add wrappers:
```ts
editorMouseDown(ev: EditorMouseEvent) { ipcRenderer.send('editor:mouseDown', ev); },
editorMouseMove(ev: EditorMouseEvent) { ipcRenderer.send('editor:mouseMove', ev); },
editorMouseUp(ev: EditorMouseEvent) { ipcRenderer.send('editor:mouseUp', ev); },
```

- [ ] **Step 2: Wire main-side dispatch**

In `Recorder.ts` after `initializeObs()`:
```ts
const editor = EditorService.getInstance();
editor.setBackend(this.backend);
editor.onCommit(({ name, x, y, scaleX }) => {
  if (name === SceneItem.GAME) {
    cfg.set('videoSourceXPosition', x);
    cfg.set('videoSourceYPosition', y);
    cfg.set('videoSourceScale', scaleX);
  } else if (name === SceneItem.OVERLAY) {
    cfg.set('chatOverlayXPosition', x);
    cfg.set('chatOverlayYPosition', y);
    cfg.set('chatOverlayScale', scaleX);
  }
});
ipcMain.on('editor:mouseDown', (_e, ev) => editor.handleMouseDown(ev));
ipcMain.on('editor:mouseMove', (_e, ev) => editor.handleMouseMove(ev));
ipcMain.on('editor:mouseUp', (_e, ev) => editor.handleMouseUp(ev));
```

- [ ] **Step 3: Update preload.d.ts types**

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(macos): IPC plumbing for editor mouse events"
```

---

### Task 10: `MacPreviewOverlay.tsx` + integrate

**Files:**
- Create: `src/renderer/MacPreviewOverlay.tsx`
- Modify: `src/renderer/RecorderPreview.tsx`

- [ ] **Step 1: Implement overlay**

```tsx
import React from 'react';

const ipc = window.electron.ipcRenderer;

const toEv = (e: React.MouseEvent) => ({
  offsetX: e.nativeEvent.offsetX,
  offsetY: e.nativeEvent.offsetY,
  button: e.button,
  altKey: e.altKey,
  shiftKey: e.shiftKey,
  metaKey: e.metaKey,
  ctrlKey: e.ctrlKey,
});

const MacPreviewOverlay = () => (
  <div
    className="absolute inset-0"
    style={{ pointerEvents: 'auto', background: 'transparent' }}
    onMouseDown={(e) => ipc.editorMouseDown(toEv(e))}
    onMouseMove={(e) => ipc.editorMouseMove(toEv(e))}
    onMouseUp={(e) => ipc.editorMouseUp(toEv(e))}
    onContextMenu={(e) => e.stopPropagation()}
  />
);

export default MacPreviewOverlay;
```

- [ ] **Step 2: Branch RecorderPreview render**

In `RecorderPreview.tsx`:
```tsx
const isMac = window.platformInfo?.platform === 'darwin';

return (
  <div className="w-full h-full box-border bg-black">
    <div
      ref={previewDivRef}
      className="relative h-full mx-12 overflow-hidden border border-black"
    >
      {isMac ? (
        <MacPreviewOverlay />
      ) : (
        <>
          {renderDraggableSceneBox(SceneItem.GAME)}
          {renderDraggableSceneBox(SceneItem.OVERLAY)}
        </>
      )}
    </div>
  </div>
);
```

- [ ] **Step 3: Repackage + test**

```bash
WCR_SIGN_IDENTITY="Developer ID Application: Yuri Piratello (Y36BG56F47)" npm run package
./scripts/dev-launch.sh
```

Verify:
- Click on game source → orange selection rect drawn by OBS
- Click empty area → selection clears
- Drag → source moves, selection follows
- mouseUp → position persisted (verify by restart, position retained)

- [ ] **Step 4: Commit**

```bash
git add src/renderer/MacPreviewOverlay.tsx src/renderer/RecorderPreview.tsx
git commit -m "feat(macos): wire MacPreviewOverlay + drop DOM boxes on Mac"
```

---

### Task 11: Cursor feedback (optional but UX-critical)

EditorService computes cursor type (default / move / nwse-resize / etc.) based on hover position over selected item bounds. Renderer applies via CSS on overlay div.

**Files:**
- Modify: `src/main/EditorService.ts` (add `getCursorAt(ev): string`)
- Modify: `src/renderer/MacPreviewOverlay.tsx` (poll cursor or react to push)

- [ ] **Step 1: Add `editor:cursor` request channel** — renderer asks for cursor on mouseMove (debounced); main returns string; renderer sets `style.cursor`.

- [ ] **Step 2: Implement getCursorAt**

```ts
getCursorAt(ev: EditorMouseEvent): string {
  if (!this.selectedName) return 'default';
  const pt = this.viewToCanvas(ev.offsetX, ev.offsetY);
  if (!pt) return 'default';
  const b = this.backend!.getSceneItemBounds(this.selectedName);
  if (!b) return 'default';
  const HANDLE_PX = 12;
  const onTL = Math.abs(pt.x - b.x) < HANDLE_PX && Math.abs(pt.y - b.y) < HANDLE_PX;
  const onBR = Math.abs(pt.x - (b.x + b.width)) < HANDLE_PX && Math.abs(pt.y - (b.y + b.height)) < HANDLE_PX;
  // ... etc
  if (onTL || onBR) return 'nwse-resize';
  if (pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height) return 'move';
  return 'default';
}
```

- [ ] **Step 3: Commit**

---

### Task 12: Reset Game / Reset Overlay buttons (verify still work)

The existing IPC `Recorder.resetSourcePosition` should keep working since it writes via OSN directly. Confirm after Mac overlay changes that the reset buttons still produce expected result + selection updates.

- [ ] **Step 1: Manual test**: click Reset Game, confirm OBS selection box snaps to new bounds.

- [ ] **Step 2: If selection box stale, call `clearSceneItemSelection()` then `setSceneItemSelected(name, true)` in `resetSourcePosition` after OSN update.**

- [ ] **Step 3: Commit if changes needed.**

---

## Self-Review Checklist

- [ ] All 12 tasks have actual code, no TBD/TODO placeholders
- [ ] Type names consistent (`SceneItemBounds`, `PreviewLayout`, `CanvasInfo` defined in IRecorderBackend, used in EditorService)
- [ ] Mac branch isolated via `window.platformInfo?.platform === 'darwin'` — Windows path unchanged
- [ ] Tests cover coord math + hit-test + drag math (the three hard parts)
- [ ] IPC channels typed in preload.d.ts
- [ ] Out-of-scope items (crop, multi-select, rotation, snapping) deferred explicitly
