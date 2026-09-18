# Replace the print viewer with the uploaded playground style

## What will change
- Rework the existing 3D print viewer into a full, dark modeling viewport inspired by the attached playground.
- Keep the current uploaded/generated mesh, material selection, scale, dimensions, and checkout handoff unchanged.
- Add playground-style scene cues: perspective grid, studio environment, directional lighting, axis orientation indicator, and compact floating controls.
- Preserve desktop and touch navigation, auto-fit the complete model after scaling, and retain the brief device-specific navigation guide.
- Adapt the existing material picker into the new viewer rather than importing the standalone SDF editor or its object-authoring tools.

## Technical details
- Implement the viewport with the project's existing React Three Fiber and Drei setup; do not add p5.js or duplicate the uploaded file's standalone rendering engine.
- Update `ThreeViewer.tsx` and the material selector presentation only where necessary.
- Use semantic project tokens for the dark viewport surfaces and controls.
- Validate the loaded-model flow at desktop and mobile widths, including orbit, zoom, scale auto-fit, dimensions, vertex colors, and material selection.
