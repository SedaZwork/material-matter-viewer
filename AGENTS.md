# Project Architecture Rules

- Own the device camera in the app-level CameraProvider so one permission and stream can serve route-level AR surfaces safely.
- Keep tracking in viewer-scoped modules: WebXR owns the camera during horizontal hit-testing, and MediaPipe uses the shared video stream for finger previews; this prevents competing camera sessions.
- Convert fabrication millimetres to metres only in AR placement clones and keep hand-fit transforms visual-only so previews never modify checkout dimensions.