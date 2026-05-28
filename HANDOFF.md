# Video GIF Android 인수인계

## 프로젝트 요약

개인용 동영상 GIF 변환 Android APK 프로젝트입니다. 기존 React/Vite 기반 변환 앱을 Capacitor Android로 패키징했습니다. Android 앱에서는 FFmpegKit으로 기기 안에서 처리하며, 영상은 서버로 업로드하지 않습니다.

- GitHub: https://github.com/AppleNote8763/video-gif-android
- Android package id: `com.applenote8763.videogifandroid`
- 현재 버전: `1.3.3`

## 기술 스택

- React 18
- Vite 5
- Tailwind CSS
- Capacitor Android
- `@ffmpeg/ffmpeg`, `@ffmpeg/core`
- FFmpegKit Android

## 주요 파일

- `src/App.jsx`: 업로드, 전체 길이 변환 옵션, 배치 변환, Android 네이티브 변환 흐름
- `src/hooks/useFFmpeg.js`: FFmpeg.wasm 로딩 및 진행률 상태
- `src/components/GifPreview.jsx`: 결과 표시, 저장 결과 표시, 웹 수동 다운로드
- `src/utils/nativeGifConverter.js`: Capacitor 네이티브 플러그인 연결
- `android/app/src/main/java/com/applenote8763/videogifandroid/NativeGifConverterPlugin.java`: Android 파일 선택, FFmpegKit 변환, MediaStore 저장
- `android/app/src/main/res/mipmap-*`, `android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml`: 릴리스 APK와 동일해야 하는 앱 런처 아이콘 리소스
- `assets/app-icon/v1.3.1-release/`: `v1.3.1` 릴리스 APK에서 복구한 앱 아이콘 PNG 백업
- `scripts/copy-ffmpeg-core.mjs`: 빌드 전 FFmpeg core 파일을 `public/ffmpeg`로 복사
- `capacitor.config.json`: Capacitor 앱 설정
- `android/`: Android APK 프로젝트

## 현재 동작

- MP4, MOV, WEBM 지원
- 단일 파일 및 여러 파일 선택 지원
- 여러 파일은 병렬이 아니라 순차 변환
- Android에서는 업로드 영역에서 선택한 여러 파일 URI를 보관하고 변환 버튼에서 그대로 사용
- 각 영상의 전체 길이로 변환
- 영상 미리보기와 시작/종료 시간 입력은 제거했습니다. 현재 정책은 모든 선택 파일을 전체 길이로 변환하는 것입니다.
- 기본값은 원본 비율과 해상도를 유지하되, 기기 부담을 줄이기 위해 짧은 변 기준 최대 1080p까지만 변환합니다.
- 품질 프리셋은 저용량, 기본, 고화질, 원본 유지(최대 1080p)를 지원합니다.
- 원본 유지 설정은 FFmpeg scale 필터에서 짧은 변 기준 `min(설정p, 원본 해상도)` 방식으로 처리하므로 원본보다 키우지 않습니다.
- 여러 영상이 섞여 있어도 파일별 원본 비율을 유지하고, 1080p 이상 원본만 최대 1080p로 제한합니다. 480x480 같은 정사각 영상도 480x480으로 유지되어야 합니다.
- 긴 영상과 250MB 초과 파일은 차단하지 않고 경고만 표시
- Android 변환 완료 후 GIF를 `Pictures/GIF Maker`에 저장
- ABI별 APK와 universal APK를 함께 생성

## 빌드

```bash
npm install
npm run android:sync
npm run android:build
```

Debug APK 위치:

```text
android/app/build/outputs/apk/debug/
```

주요 출력 APK:

- `app-arm64-v8a-debug.apk`: 최신 Android 폰용 경량 APK
- `app-universal-debug.apk`: 호환용 APK

필요 환경:

- JDK 21
- Android SDK
- Windows에서는 `JAVA_HOME`, `ANDROID_HOME` 설정 필요

마지막으로 검증한 APK:

- 빌드 명령: `npm run android:build`
- arm64 APK: `android/app/build/outputs/apk/debug/app-arm64-v8a-debug.apk` 약 40.7MB
- universal APK: `android/app/build/outputs/apk/debug/app-universal-debug.apk` 약 132.0MB
- 업로드용 파일: `video-gif-android-v1.3.3-arm64-debug.apk`, `video-gif-android-v1.3.3-universal-debug.apk`

## 작업 메모

- 원본 PWA/Vercel 프로젝트는 `AppleNote8763/video-gif-pwa`에 따로 유지됩니다.
- 이 repo에서는 PWA/Vercel 설정과 service worker를 제거했습니다.
- 사용자가 명시하지 않으면 UI는 변경하지 않는 편이 좋습니다.
- 하드 시간 제한이나 파일 크기 차단은 다시 넣지 마세요. 현재 정책은 경고만 표시하는 방식입니다.
- 시작/종료 시간 선택과 영상 미리보기는 다시 넣지 마세요. Android 네이티브 파일 URI 흐름에서는 미리보기가 안정적으로 보장되지 않고, 현재 UX는 전체 길이 변환 기준입니다.
- 원본 유지 옵션은 업스케일 옵션이 아니라 짧은 변 기준 최대 해상도 상한입니다. FFmpeg scale 필터는 짧은 변이 설정값보다 클 때만 축소하고, 가로/세로 비율은 유지해야 합니다. 여러 파일을 변환할 때도 각 파일별 원본 해상도 기준으로 적용되어야 합니다.
- Android GIF 저장 위치는 `Pictures/GIF Maker`입니다. `MediaStore.Images`에 `Download`를 쓰면 Android 11+에서 `Primary directory Download not allowed` 오류가 날 수 있으니 되돌리지 마세요.
- 앱 아이콘 리소스는 `v1.3.1` 릴리스 APK에서 추출해 현재 소스에 복구했습니다. 백업은 `assets/app-icon/v1.3.1-release/`에 있습니다. 새 APK를 빌드하기 전에 `android/app/src/main/res/mipmap-*`의 `ic_launcher*.png`와 `drawable-v24/ic_launcher_foreground.xml`을 기본 Android 아이콘으로 되돌리지 마세요.
- Android WebView에서도 백그라운드 변환은 보장되지 않습니다. 변환 중에는 앱을 켜두는 안내가 필요합니다.
