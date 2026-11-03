# Neon Rush — Three.js Endless Runner

A low-poly 3D endless runner built with Three.js and Vite. It includes lane switching, jumping, obstacles, coins, score, progressive levels, pause/resume, sound effects, touch controls, swipe controls, and a locally saved best score.

## Requirements
- Node.js 20.19+ or 22.12+
- npm

## Run locally
```bash
npm install
npm run dev
```
Open the local URL printed by Vite (usually http://localhost:5173).

## Controls
- Left / Right arrows or A / D: change lanes
- Up arrow, W, or Space: jump
- P or Escape: pause/resume
- Touch: use the on-screen left, jump, and right buttons; swipe left/right to change lanes and swipe up to jump.

## Production build
```bash
npm run build
npm run preview
```
The production output is generated in `dist/`.

## Deploy to Vercel
1. Push this folder to a GitHub repository.
2. In Vercel, choose **Add New → Project** and import the repository.
3. Framework preset: **Vite**.
4. Build command: `npm run build`.
5. Output directory: `dist`.
6. Click **Deploy**.

You can also deploy with the Vercel CLI:
```bash
npm install -g vercel
vercel
vercel --prod
```

## Notes
- Best score is stored in browser `localStorage` on the current device/browser.
- The game uses procedural low-poly geometry; no external 3D model files are required.
- Google Fonts are loaded from the web. The game still works with fallback fonts if unavailable.
