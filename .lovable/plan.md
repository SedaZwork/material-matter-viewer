# AR-first homepage and camera viewer upgrade

## Goal

Turn the current homepage into an immersive, camera-backed recipe launcher while preserving every existing recipe, generator, material rule, model handoff, account flow, and checkout flow.

The first release will be an installable web app. It will prepare clean extension points for hand tracking and plane/object recognition, but those capabilities will not be implemented yet.

## Experience flow

```text
Open app
  → Welcome screen
  → Enable camera (primary) or Continue without camera
  → Orbital recipe carousel over live camera or current fallback background
  → Select recipe
  → Existing recipe generator
  → Existing 3D print viewer with live camera behind the model
  → Existing materials, quote, and checkout
```

## Homepage redesign

- Replace only the current recipe grid with a horizontal-axis orbital carousel inspired by the supplied reference.
- Arrange recipe cards around a curved vertical orbit, with the focused recipe centered and neighboring recipes visibly receding in depth.
- Support touch drag, mouse drag, wheel/trackpad, keyboard arrows, card selection, and accessible previous/next controls.
- Use spring-based movement with shortest-path snapping, subtle image parallax, and reduced-motion behavior.
- Keep the selected recipe’s title, description, availability, and action clearly readable outside the moving cards.
- Preserve unavailable recipes and all current navigation destinations.
- Pause idle rotation after interaction and while the page is hidden; avoid motion that depends on frame rate.

## Camera-first background

- Add a welcome prompt with a clear **Enable camera** action and a secondary **Continue without camera** action.
- Request the rear camera on phones and the most suitable camera on other devices only after that action.
- Display the live video full-screen behind the carousel with a light blur and restrained overlay so cards remain readable.
- If access is denied, unavailable, interrupted, or insecure, immediately retain the current homepage background without blocking the app.
- Add a persistent camera on/off control and clear active-camera status.
- Stop camera tracks when the user turns the camera off or leaves the app; do not record, upload, or store camera imagery.

## Shared AR session

- Replace route-local camera ownership with one app-level camera session shared by the homepage, recipe pages, and the final viewer.
- Keep a single media stream alive during internal recipe navigation so users are not repeatedly prompted.
- Let each screen attach its own video surface to that stream while retaining safe cleanup and permission-error handling.
- Keep existing generator camera buttons working through the same shared session.

## Camera-backed 3D viewer

- For models reached from a selected recipe, place the live camera video behind the existing Three.js canvas.
- Make the canvas background transparent while camera mode is active; retain the current dark studio when it is not.
- Preserve model orbit, pan, zoom, centering, scaling, vertex colors, PBR materials, recipe-specific material filtering, dimensions, and checkout.
- Keep local studio lights and reflections for stable material appearance; the camera is a visual environment background, not yet a lighting probe or tracked AR scene.
- Scope camera mode to recipe-originated models. Direct uploads retain the current viewer unless the user explicitly enables camera mode.

## Installable web app

- Add a web app manifest, app icons, theme color, and Apple home-screen metadata.
- Use standalone display mode so the published app can launch from a phone’s home screen.
- Do not add offline caching or a service worker in this phase.

## Technical details

- Introduce an app-level camera provider around routing with stream state, permission state, start/stop controls, and video attachment helpers.
- Add a small reusable camera backdrop used by both the orbital homepage and 3D viewer.
- Implement the carousel with React state plus `requestAnimationFrame`; no new animation dependency is required.
- Pass recipe origin and camera preference through the existing navigation/handoff flow without changing model generation or commerce data.
- Use semantic design tokens for overlays and controls, and preserve the project’s light aero design language over the real-world camera feed.
- Respect `prefers-reduced-motion`, keyboard focus, screen-reader labels, and touch-action boundaries.

## Validation

- Verify camera allowed, denied, unavailable, and later-disabled states.
- Verify carousel dragging, snapping, controls, recipe routing, and unavailable recipes on phone and desktop sizes.
- Verify the camera survives homepage → generator → viewer navigation without repeated prompts.
- Verify all existing recipe generators, geometry handoffs, material filtering, model controls, quote, and checkout remain unchanged.
- Verify no camera stream remains active after the user disables it or exits the app.
- Verify home-screen installation metadata on iPhone and Android-compatible browsers.

## Future-ready boundaries

- Reserve a camera-frame analysis layer for hand landmarks, plane anchors, and object recognition.
- Reserve model placement transforms separately from the current orbit camera controls.
- Do not ship simulated tracking, fake placement, or camera-frame uploads in this phase.