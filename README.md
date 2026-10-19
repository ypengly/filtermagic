# FilterMagic

A super-cute live camera filter website. Open your camera, try 30 filters, take selfies, and download them as PNGs.
Everything runs in your browser: photos and video are never uploaded.

Built with HTML5, CSS3, vanilla JavaScript (ES modules), WebRTC `getUserMedia`, the Canvas API and LocalStorage.
Face-anchored effects use [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/solutions/vision/face_landmarker).

## Run it locally

ES modules and the camera need a web server (opening `index.html` from the file system will not work).
Camera access works on `http://localhost` and on any `https://` page.

```bash
npm start          # serves http://localhost:8080 (uses npx http-server, needs Node 18+)
# or, with Python only:
python3 -m http.server 8080
```

Open <http://localhost:8080> and press **Start camera**.

### Testing on a phone or tablet over your network

Phones will not give camera access to `http://192.168.x.x`. Use HTTPS:

```bash
# 1. make a local certificate (mkcert is easiest: https://github.com/FiloSottile/mkcert)
mkcert -install && mkcert -key-file key.pem -cert-file cert.pem localhost 192.168.1.50
# 2. serve over HTTPS
npm run start:https     # https://<your-ip>:8443
```

Or tunnel your local server with a service such as Cloudflare Tunnel or ngrok, which gives you an HTTPS URL.

## Deploy (HTTPS hosting)

FilterMagic is a static site with no build step. Upload the whole folder to any static host that serves HTTPS:
GitHub Pages, Netlify, Vercel, Cloudflare Pages or Firebase Hosting. Publish the repository root
(`index.html`, `src/`, `public/`). Camera permission only works on the HTTPS URL these hosts give you.

## Using the app

- **Live**: press *Start camera*, pick a filter from the carousel, press the big shutter. Use the timer button to cycle Off / 3s / 5s / 10s.
- **Intensity**: the slider scales every filter from 0% to 100%. **Reset** returns to Original at 100%.
- **Save** (heart) adds the current filter to Favorites. **Compare** shows before and after with a slider.
- **Mirror** flips the selfie preview (and the saved photo to match). The rear camera turns mirroring off automatically.
- **Flip cam** appears when the device has more than one camera.
- **Edit**: upload an image (or drag one onto the preview), apply filters, then **Download PNG**. After taking a photo you land in Edit, where you can still change the filter before downloading. **Retake** returns to the camera.
- **My photos** keeps this session's captures (up to 24). They are held in memory only, not in LocalStorage.

Favorites, theme, last filter, intensity, timer, mirror and camera choice persist in LocalStorage.

## Face tracking and fallback

Cat, Puppy, Bunny, Bear, Angel, Rosy Blush, Cherry Lips, Heart Eyes, Starry Face, Rainbow Magic, Kawaii Sparkles and Super Cute
anchor their decorations to real face landmarks (forehead, eyes, nose, cheeks, lips and head tilt) and follow your movement.

The tracker loads on demand, only after the camera is on or a photo is open, from jsDelivr (WebAssembly runtime) and
Google Storage (model file, about 4 MB). Video frames are processed locally; only those library files are downloaded.
If it cannot load (offline, blocked, unsupported browser), the app says so and applies the colour part of each effect.
It never draws static decorations pretending to be tracked.
If no face is visible the decorations hide and a hint appears.

To self-host the library, download `@mediapipe/tasks-vision` (`vision_bundle.mjs` and its `wasm/` folder) and
`face_landmarker.task`, then change the URLs in `FACE_CONFIG` at the top of `src/face/faceTracker.js`.

## Project structure

```
index.html
package.json
public/favicon.svg
src/
  main.js                  app wiring, state, render loop
  styles/                  main.css, camera.css, filters.css, responsive.css
  camera/
    cameraController.js    getUserMedia, front/rear switch, releasing tracks, error codes
    frameRenderer.js       draws a source + filter onto a canvas (live preview and export share it)
    photoCapture.js        frame grab, export, download, helpers
  filters/
    filterRegistry.js      the 30 filters, search, and the staged pipeline
    colorFilters.js        grading, sepia, B&W, film, neon
    beautyFilters.js       soft beauty, dreamy, rainbow wash
    artisticFilters.js     cartoon, sketch, glitch, pixel art
    overlayFilters.js      face-anchored ears, noses, blush, lips, hearts, sparkles
  face/faceTracker.js      MediaPipe loading, smoothing, face geometry
  ui/                      filterGallery.js (carousel + thumbnails), controls.js, theme.js
  utils/                   canvasUtils.js, storage.js
tests/filters.test.js
```

A filter is a plain object. Its optional stages run in this order: `pre` (canvas) -> `pixel` (ImageData) -> `post` (canvas) -> `overlay` (face-anchored).
To add a filter, write the stage functions and add one entry to `FILTERS` in `filterRegistry.js`; the carousel,
search, favorites and export pick it up automatically. Filter thumbnails are generated at start-up, so no image assets are needed.

## Tests

```bash
npm test
```

Checks the 30-filter registry, intensity behaviour of every pixel filter (0% = unchanged, stronger at higher values),
search and categories, face geometry and mirroring, and that every face overlay draws only when landmarks exist.

## Privacy

No analytics, no uploads, no server. The camera starts only after you press *Start camera*, stops when you turn it off
or leave the page, and all tracks are released.

## Browser support

Current Chrome, Edge, Firefox and Safari on Windows, macOS, Linux, Android, iOS and iPadOS.
Needs `getUserMedia`, canvas and ES modules; unsupported features show a clear message instead of failing silently.
iOS Safari: if the PNG opens in a new tab instead of downloading, press and hold it and choose Save to Photos.
