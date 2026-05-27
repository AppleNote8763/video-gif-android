# Video GIF Android 인수인계

## 프로젝트 요약

개인용 동영상 GIF 변환 Android APK 프로젝트입니다. 기존 React/Vite 기반 변환 앱을 Capacitor Android로 패키징했습니다. 변환은 FFmpeg.wasm으로 기기 안에서 처리하며, 영상은 서버로 업로드하지 않습니다.

- GitHub: https://github.com/AppleNote8763/video-gif-android
- Android package id: `com.applenote8763.videogifandroid`
- 현재 버전: `1.1.6`

## 기술 스택

- React 18
- Vite 5
- Tailwind CSS
- Capacitor Android
- `@ffmpeg/ffmpeg`, `@ffmpeg/core`

## 주요 파일

- `src/App.jsx`: 업로드, 변환 옵션, 배치 변환, 자동 다운로드 흐름
- `src/hooks/useFFmpeg.js`: FFmpeg.wasm 로딩 및 진행률 상태
- `src/components/GifPreview.jsx`: 결과 미리보기, 파일명 수정, 수동 다운로드
- `scripts/copy-ffmpeg-core.mjs`: 빌드 전 FFmpeg core 파일을 `public/ffmpeg`로 복사
- `capacitor.config.json`: Capacitor 앱 설정
- `android/`: Android APK 프로젝트

## 현재 동작

- MP4, MOV, WEBM 지원
- 단일 파일 및 여러 파일 선택 지원
- 여러 파일은 병렬이 아니라 순차 변환
- 단일 파일은 시작/종료 시간 수정 가능
- 여러 파일은 각 영상의 전체 길이로 변환
- 긴 영상과 250MB 초과 파일은 차단하지 않고 경고만 표시
- 변환 완료 후 GIF 자동 다운로드
- 결과별 파일명 수정 및 다시 다운로드 가능

## 빌드

```bash
npm install
npm run android:sync
npm run android:build
```

Debug APK 위치:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

필요 환경:

- JDK 21
- Android SDK
- Windows에서는 `JAVA_HOME`, `ANDROID_HOME` 설정 필요

마지막으로 재빌드한 APK:

- 파일: `C:\Users\user\Desktop\video-gif-android-v1.1.6-debug.apk`
- SHA256: `57252E0F52B8B8D77F35747A34CB8D9BD3CD0B7191B0B5A143252774AF9E2B8D`

## 작업 메모

- 원본 PWA/Vercel 프로젝트는 `AppleNote8763/video-gif-pwa`에 따로 유지됩니다.
- 이 repo에서는 PWA/Vercel 설정과 service worker를 제거했습니다.
- 사용자가 명시하지 않으면 UI는 변경하지 않는 편이 좋습니다.
- 하드 시간 제한이나 파일 크기 차단은 다시 넣지 마세요. 현재 정책은 경고만 표시하는 방식입니다.
- Android WebView에서도 백그라운드 변환은 보장되지 않습니다. 변환 중에는 앱을 켜두는 안내가 필요합니다.
