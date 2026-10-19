# Muhammad Haris — Portfolio

A static portfolio. The loader deals 16 cards into a small, tilted ring while a real progress counter rolls up. Then the same ring opens into the full-screen 3D carousel hero. It has no build step and no framework, just HTML, CSS and ES modules.

## Run locally

ES modules don't load from `file://`, so serve the folder:

```bash
python -m http.server 5173
```

Then open http://localhost:5173.

## Test the pose function

```bash
npm test
```

## Deploy

Drag the folder onto https://app.netlify.com/drop, or point any static host at it. You don't need a build command, and the publish directory is the repo root.

## Where things live

- `js/reel-ring.js`: pure math. `reelAngle`, `reelScene(expansion)`, `reelPose(angle, formation, scene)`.
- `js/cards.js`: the 16 card faces and their links. Edit this file to change projects.
- `js/main.js`: the entrance (formation → expansion), drag/swipe/keyboard and the rolling counter.
- `css/style.css`: everything visual. Tweak `START` / `END` in `reel-ring.js` to change the camera.
