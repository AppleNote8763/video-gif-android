# Video GIF Android Handoff

## Project Summary

This is the Android APK track for a personal-use video-to-GIF converter. It wraps the React/Vite app in Capacitor Android and keeps conversion local with FFmpeg.wasm.

GitHub repo: https://github.com/AppleNote8763/video-gif-android

## Current Stack

- React 18
- Vite 5
- Tailwind CSS
- Capacitor Android
- @ffmpeg/ffmpeg and @ffmpeg/core

## Important Files

- `src/App.jsx`: Main app state, upload handling, batch queue state, conversion options, FFmpeg conversion flow, automatic GIF downloads.
- `src/hooks/useFFmpeg.js`: Loads FFmpeg.wasm and exposes ready/loading/progress/error state.
- `src/utils/ffmpegHelpers.js`: Validates accepted video formats.
- `src/components/FileUploadCard.jsx`: Upload/drop UI with multiple-file selection.
- `src/components/VideoPreview.jsx`: Source video preview.
- `src/components/GifPreview.jsx`: GIF result list, preview, file-name editing, and manual download.
- `scripts/copy-ffmpeg-core.mjs`: Copies FFmpeg core files into `public/ffmpeg` before dev/build.
- `vite.config.js`: Vite config, app version injection, and dev/preview COOP/COEP headers.
- `capacitor.config.json`: Capacitor app id/name and Android web asset directory.
- `android/`: Capacitor Android project.

## Current Behavior

- Supports MP4, MOV, and WEBM uploads.
- Supports selecting multiple videos at once.
- Multiple selected videos are converted sequentially, not in parallel.
- Multiple selected videos are converted using each video's full detected duration.
- Single-file conversion defaults to the video's full detected duration, while still allowing manual start/end edits.
- GIF conversion duration is warning-only; long clips are not blocked.
- File size over 250MB is warning-only; upload and conversion are not blocked by size.
- Quality presets control width, FPS, color count, and palette use.
- Completed GIFs start downloading automatically after conversion finishes.
- Manual per-result download buttons remain available.
- Videos are processed locally; they are not uploaded to a server.

## Android Build

```bash
npm install
npm run android:sync
npm run android:build
```

Debug APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Build requirements:

- JDK 21.
- Android SDK platform/build-tools matching `android/variables.gradle`.
- On Windows, set `JAVA_HOME` and `ANDROID_HOME` before running Gradle.
- This machine has portable local tooling under ignored `.tools/`.

Last successful debug APK build used:

- JDK: Temurin 21.0.11
- APK path: `android/app/build/outputs/apk/debug/app-debug.apk`
- APK SHA256: `8696CBDD046F0556921C1FBD307D141B36162E7F2BF44B96BA2E89ABA8F7B141`

## Recent Changes

- Capacitor Android project added.
- PWA/Vercel-specific files and service worker registration removed from this Android repo.
- `vite-plugin-pwa` removed.
- Package name changed to `video-gif-android`.
- `.tools/` ignored for local portable JDK/Android SDK.

## Notes For Next Chat

- The original Vercel/PWA project remains separate in `AppleNote8763/video-gif-pwa`.
- The user does not want UI changes unless explicitly requested.
- Practical S10e/mobile behavior matters more than broad public-user guardrails.
- Do not reintroduce hard duration or file-size blocking unless explicitly requested.
- Background conversion is still not guaranteed in Android WebView; keep the app open during conversion.
