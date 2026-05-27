# Video GIF Android

Android APK packaging for a local video-to-GIF converter. The app uses React/Vite, Capacitor Android, and FFmpeg.wasm to convert local MP4, MOV, and WEBM files on device without uploading videos to a server.

Current version: `v1.1.6`

## Features

- Select one or more MP4, MOV, or WEBM videos.
- Convert videos to GIFs sequentially with FFmpeg.wasm.
- Single-file conversion supports manual start/end time edits.
- Multiple-file conversion uses each video's detected full duration.
- Large files and long GIFs show warnings but are not blocked.
- Completed GIFs start downloading automatically.
- Result cards still support file-name editing and manual re-download.

## Android APK

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

- JDK 21
- Android SDK platform/build-tools matching `android/variables.gradle`
- On Windows, `JAVA_HOME` must point to JDK 21 and `ANDROID_HOME` must point to the Android SDK.

This machine also has local ignored tooling under `.tools/` for portable JDK/Android SDK builds.

## Local Web Build

```bash
npm install
npm run build
```

Before Vite builds, `scripts/copy-ffmpeg-core.mjs` copies `@ffmpeg/core` files into `public/ffmpeg`.

## Notes

- The Android app is a Capacitor WebView wrapper around the existing browser-based converter.
- Background conversion is still not guaranteed. Keep the app open while FFmpeg.wasm is converting.
- The generated debug APK is for installation testing. Release distribution needs a signed release APK or AAB.
