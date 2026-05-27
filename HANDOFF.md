# Video GIF PWA Handoff

## Project Summary

This is a personal-use React/Vite PWA that converts local video files to GIFs directly in the browser using FFmpeg.wasm. It is deployed on Vercel and intended to be installable on a phone through the browser's "Add to Home Screen" flow.

Production URL: https://video-gif-pwa.vercel.app/

## Current Stack

- React 18
- Vite 5
- Tailwind CSS
- vite-plugin-pwa
- @ffmpeg/ffmpeg and @ffmpeg/core
- Capacitor Android
- Vercel deployment with cross-origin isolation headers

## Important Files

- `src/App.jsx`: Main app state, upload handling, batch queue state, conversion options, FFmpeg conversion flow.
- `src/hooks/useFFmpeg.js`: Loads FFmpeg.wasm and exposes ready/loading/progress/error state.
- `src/utils/ffmpegHelpers.js`: Validates accepted video formats.
- `src/components/FileUploadCard.jsx`: Upload/drop UI with multiple-file selection.
- `src/components/VideoPreview.jsx`: Source video preview.
- `src/components/GifPreview.jsx`: GIF result list, preview, file-name editing, and download.
- `vite.config.js`: Vite, PWA manifest, app version injection, and dev/preview COOP/COEP headers.
- `vercel.json`: Vercel COOP/COEP/CORP headers for FFmpeg.wasm and PWA behavior.
- `scripts/copy-ffmpeg-core.mjs`: Copies FFmpeg core files into `public/ffmpeg` before dev/build.
- `capacitor.config.json`: Capacitor app id/name and Android web asset directory.
- `android/`: Generated Capacitor Android project for APK builds.

## Current Behavior

- Supports MP4, MOV, and WEBM uploads.
- Supports selecting multiple videos at once.
- Multiple selected videos are converted sequentially, not in parallel.
- Multiple selected videos are converted using each video's full detected duration.
- Single-file conversion defaults to the video's full detected duration, while still allowing manual start/end edits.
- GIF conversion duration is warning-only; long clips are not blocked.
- File size over 250MB is warning-only; upload and conversion are not blocked by size.
- Quality presets control width, FPS, color count, and palette use.
- Each completed GIF starts downloading automatically after conversion finishes.
- The app uses local browser processing only; videos are not uploaded to a server.
- The PWA is configured for installable mobile use from the Vercel deployment.
- The UI warns users to keep the app open while conversion is running because screen-off/background behavior can interrupt FFmpeg.wasm.

## Recent Change

The app has an Android APK packaging track:

- Capacitor Android was added around the existing React/Vite PWA.
- `npm run android:sync` builds the web app and syncs `dist` into Android assets.
- `npm run android:build` runs sync and then `gradlew.bat assembleDebug`.
- Debug APK output should be `android/app/build/outputs/apk/debug/app-debug.apk`.
- Android builds require a JDK. On the current Windows machine, Gradle stopped because `JAVA_HOME` was not set and `java` was not in PATH.
- Vercel/PWA deployment remains separate and is not removed by the Android repo.

The app was updated to `1.1.6` with these behavior changes:

- Completed GIFs now start downloading automatically immediately after each file finishes converting.
- Multiple-file conversion still runs sequentially; each finished GIF downloads as it completes.
- Manual per-result download buttons remain available for retrying or downloading again.
- Version was bumped to `1.1.6`.

Implementation details:

- `downloadGif(gifURL, fileName)` centralizes the generated anchor download behavior.
- `handleConvert` calls `downloadGif` after each successful `convertFile` result.
- Existing manual download handlers now reuse `downloadGif`.
- Browser and mobile PWA background limitations still apply; keep the app open during conversion.

The app was updated to `1.1.5` with these behavior changes:

- Removed the hard 30-second conversion limit. Long clips now show a warning but can still convert.
- Single-file uploads now default the end time to the full detected video duration instead of 10 seconds.
- Multiple-file conversion now reads each video's metadata and converts `0` to the video's full detected duration.
- When multiple files are selected, the manual start/end inputs are disabled because each selected video uses its own full duration.
- Long files over `LONG_GIF_WARNING_DURATION` still warn that mobile conversion may be slow or fail.
- The 250MB file-size policy remains warning-only; oversized files are still accepted.
- Version was bumped to `1.1.5`.

Implementation details:

- `getVideoDuration(file)` creates a temporary video element and object URL to read metadata before converting each batch item.
- `handleConvert` skips manual start/end validation for multiple-file batches.
- `convertFile(selectedFile, range)` accepts a per-file range. Single-file conversion uses the UI range; multiple-file conversion uses `{ start: 0, end: detectedDuration }`.
- Do not reintroduce a hard duration or file-size block unless the user explicitly asks for blocking behavior.

The app was updated to `1.1.4` with these behavior changes:

- File upload now accepts multiple videos in one selection/drop.
- Batch conversion runs one file at a time: convert, clean FFmpeg virtual files, then move to the next file.
- Each completed source video creates its own GIF result.
- Result cards support per-GIF file-name editing and individual downloads.
- Failed files are shown in the result area and do not stop later files from converting.
- The conversion button now says `GIF 순차 변환 시작` when multiple files are selected.
- A conversion warning was added below the button: `변환 중에는 앱을 계속 열어두세요. 화면이 꺼지면 변환이 중단될 수 있습니다.`
- Version was bumped to `1.1.4`.

Implementation details:

- `selectedFiles` stores the current file queue. `file` remains the first selected file for the existing preview/options flow.
- `results` stores per-file status and output data: queued, converting, done, or failed.
- `batchProgress` stores the current batch index and file name for the status panel.
- `handleConvert` builds a queued result list and processes `filesToConvert` with a `for...of` loop.
- `convertFile` is the inner FFmpeg helper used for each source file. It always unlinks input, palette, and output files in `finally`.
- Batch conversion intentionally does not run FFmpeg jobs in parallel because mobile memory pressure is the main reliability risk.
- For multiple files, end-time validation against `videoDuration` is skipped because only the first file's metadata is loaded in the current UI.

The app was updated to `1.1.3` with these behavior changes:

- GIF download names default to the source video name with a `.gif` extension.
- The generated GIF file name can be edited before download.
- GIF conversion length was increased from 15 seconds to 30 seconds.
- Clips over 20 seconds show a mobile performance warning, but quality, FPS, and color settings are not automatically reduced.

The upload size behavior was changed from a hard 250MB block to a warning-only policy:

- Files over 250MB now still upload and preview.
- A warning is shown that conversion may be slow or fail on a phone.
- Unsupported file formats are still blocked.

Implementation details:

- `MAX_FILE_SIZE` in `src/App.jsx` remains `250 * 1024 * 1024`.
- `handleFile` calls `validateVideoFile(selectedFile)` without the size limit so size does not block upload.
- If `selectedFile.size > MAX_FILE_SIZE`, `handleFile` sets a warning message after creating the preview URL.
- `validateVideoFile` in `src/utils/ffmpegHelpers.js` only applies size validation when a `maxSize` argument is provided.

## Verified

Last checked with:

```bash
npm.cmd run build
```

The build completed successfully.

## Notes For Next Chat

- The user does not want UI changes unless explicitly requested.
- This is a personal app, so practical S10e/mobile behavior matters more than broad public-user guardrails.
- For future behavior or feature changes, bump the app version in `package.json` as part of the same patch.
- If working on mobile reliability, focus on FFmpeg memory use, large-file warnings, clip duration, width/FPS defaults, and Vercel/PWA cache behavior.
- The Korean text in terminal output may appear garbled depending on shell encoding, but the app has built successfully.
