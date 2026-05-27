# Video GIF Android

동영상을 GIF로 변환하는 Android APK 프로젝트입니다. React/Vite 앱을 Capacitor Android로 감싸고, FFmpeg.wasm으로 기기 안에서 변환합니다. 영상은 서버로 업로드하지 않습니다.

현재 버전: `v1.1.6`

## 주요 기능

- MP4, MOV, WEBM 동영상 선택
- 단일 파일 또는 여러 파일 선택
- 여러 파일은 순차 변환
- 단일 파일은 시작/종료 시간 조정 가능
- 여러 파일은 각 영상의 전체 길이로 변환
- 긴 영상과 250MB 초과 파일은 차단하지 않고 경고만 표시
- 변환 완료 후 GIF 자동 다운로드
- 결과별 파일명 수정 및 다시 다운로드 지원

## APK 빌드

```bash
npm install
npm run android:sync
npm run android:build
```

Debug APK 생성 위치:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

빌드 요구사항:

- JDK 21
- Android SDK
- Windows에서는 `JAVA_HOME`, `ANDROID_HOME` 설정 필요

## 주의

- 현재 APK는 설치 테스트용 debug 빌드입니다.
- 정식 배포용은 서명된 release APK 또는 AAB를 따로 만들어야 합니다.
- 변환 중에는 앱을 켜두는 것이 안전합니다. 백그라운드 전환이나 화면 꺼짐 시 변환이 중단될 수 있습니다.
