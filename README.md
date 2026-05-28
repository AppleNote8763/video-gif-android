# Video GIF Android

동영상을 GIF로 변환하는 Android APK 프로젝트입니다. React/Vite 앱을 Capacitor Android로 감싸고, Android 앱에서는 FFmpegKit으로 기기 안에서 변환합니다. 영상은 서버로 업로드하지 않습니다.

현재 버전: `v1.3.3`

## 주요 기능

- MP4, MOV, WEBM 동영상 선택
- 단일 파일 또는 여러 파일 선택
- 여러 파일은 순차 변환
- Android에서는 업로드 영역에서 선택한 여러 파일을 그대로 네이티브 순차 변환
- 각 영상의 전체 길이로 변환
- 영상 미리보기와 시작/종료 시간 선택 없이 전체 길이 기준으로 변환
- 기본값은 원본 비율과 해상도를 유지하되, 기기 부담을 줄이기 위해 짧은 변 기준 최대 1080p까지만 변환
- 품질 프리셋은 저용량, 기본, 고화질, 원본 유지(최대 1080p)를 지원
- 원본 유지 설정은 파일별 원본 해상도를 넘지 않음
- 여러 영상이 섞여 있어도 각 파일의 원본 비율을 유지하고, 1080p 이상 원본만 최대 1080p로 제한
- 긴 영상과 250MB 초과 파일은 차단하지 않고 경고만 표시
- 변환 완료 후 GIF를 `Pictures/GIF Maker`에 저장
- ABI별 APK와 universal APK 생성 지원

## APK 빌드

```bash
npm install
npm run android:sync
npm run android:build
```

Debug APK 생성 위치:

```text
android/app/build/outputs/apk/debug/
```

주요 출력 APK:

- `app-arm64-v8a-debug.apk`: 최신 Android 폰용 경량 APK
- `app-universal-debug.apk`: 호환용 APK

빌드 요구사항:

- JDK 21
- Android SDK
- Windows에서는 `JAVA_HOME`, `ANDROID_HOME` 설정 필요

## 주의

- 현재 APK는 설치 테스트용 debug 빌드입니다.
- 정식 배포용은 서명된 release APK 또는 AAB를 따로 만들어야 합니다.
- 변환 중에는 앱을 켜두는 것이 안전합니다. 백그라운드 전환이나 화면 꺼짐 시 변환이 중단될 수 있습니다.
- GIF는 Android MediaStore 제한에 맞춰 `Pictures/GIF Maker`에 저장합니다.
- 1080 GIF는 변환 시간과 파일 용량이 크게 증가할 수 있습니다.
