# Video to GIF PWA

브라우저 안에서 동영상을 GIF로 변환하는 설치형 PWA입니다. 서버 업로드 없이 FFmpeg.wasm이 사용자의 브라우저에서 변환을 처리합니다.

현재 버전: `v1.1.6`

## 주요 기능

- MP4, MOV, WEBM 동영상 업로드
- 여러 동영상 동시 선택 및 순차 일괄 변환
- 단일 동영상은 기본값으로 영상 전체 길이 변환, 필요 시 시작/종료 시간 선택
- 모바일 친화적인 GIF 품질 프리셋
- GIF 미리보기 및 다운로드
- 변환이 완료된 GIF 자동 다운로드
- 홈 화면 추가를 통한 PWA 설치
- 첫 로딩 이후 오프라인 사용 지원

## 일괄 변환 동작

여러 동영상을 한 번에 선택할 수 있지만, 변환은 모바일 안정성을 위해 한 파일씩 순서대로 진행합니다.

예를 들어 `A.mp4`, `B.mp4`, `C.mp4`를 선택하면 앱은 각 영상의 전체 길이를 자동으로 확인한 뒤 `A` 변환과 정리를 마친 뒤 `B`, 그 다음 `C`를 처리합니다. 각 동영상은 각각의 GIF 결과로 표시되며, 결과별 파일명을 수정하고 개별 다운로드할 수 있습니다.

변환 중에는 앱을 계속 열어두어야 합니다. 화면이 꺼지거나 앱이 백그라운드로 이동하면 변환이 중단될 수 있습니다.

단일 동영상을 선택해도 기본 종료 시간은 영상 전체 길이로 설정됩니다. 긴 영상이나 250MB를 넘는 파일도 업로드와 변환을 막지는 않습니다. 대신 휴대폰에서 변환이 느리거나 실패할 수 있다는 경고만 표시합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

로컬 개발 서버와 preview 서버에는 FFmpeg.wasm 실행에 필요한 COOP/COEP 헤더가 설정되어 있습니다.

## 빌드

```bash
npm run build
```

빌드 전에 `scripts/copy-ffmpeg-core.mjs`가 `@ffmpeg/core` 파일을 `public/ffmpeg`로 복사합니다. Vite의 기본 base path는 Vercel 루트 배포에 맞춰 `/`입니다.

GitHub Pages 같은 하위 경로 배포가 필요할 때만 환경변수로 base path를 지정합니다.

```bash
VITE_BASE_PATH=/video-gif-pwa/ npm run build
```

## Android APK

이 저장소는 Capacitor 기반 Android 프로젝트를 포함합니다. 웹/PWA 기능은 유지하고, `dist` 빌드 결과를 Android WebView 앱 안에 동기화합니다.

```bash
npm install
npm run android:sync
npm run android:build
```

Debug APK 산출물은 빌드 성공 후 `android/app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다.

APK 빌드에는 JDK가 필요합니다. Windows에서는 `java`가 PATH에 있거나 `JAVA_HOME`이 설치된 JDK 경로를 가리켜야 합니다.

## Vercel 배포

Vercel 프로젝트 설정은 기본값을 사용합니다.

- Framework Preset: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`

`vercel.json`은 모든 경로에 아래 보안 헤더를 적용합니다.

- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Resource-Policy: same-origin`

이 헤더는 브라우저의 cross-origin isolation을 활성화해 FFmpeg.wasm과 PWA가 모바일 Chrome에서도 안정적으로 동작하도록 돕습니다.

## PWA 확인

배포 후 Chrome DevTools의 Application 탭에서 다음을 확인합니다.

- Manifest의 `start_url`과 `scope`가 `/`인지
- 아이콘이 `/icon-192.png`, `/icon-512.png`로 로드되는지
- Service Worker가 등록되는지
- 오프라인 전환 후 앱이 다시 열리는지
- `/ffmpeg/ffmpeg-core.js`, `/ffmpeg/ffmpeg-core.wasm`, `/ffmpeg/ffmpeg-core.worker.js`가 정상 로드되는지

## GitHub Pages

Vercel만 사용할 경우 GitHub Actions 기반 Pages 배포 워크플로는 제거해도 됩니다. GitHub Pages를 백업 배포로 유지하려면 워크플로에서 `VITE_BASE_PATH=/video-gif-pwa/`를 설정해 빌드하면 됩니다.
