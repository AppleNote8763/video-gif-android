import { useEffect, useMemo, useState } from 'react'
import { fetchFile } from '@ffmpeg/ffmpeg'
import FileUploadCard from './components/FileUploadCard'
import GifPreview from './components/GifPreview'
import { useFFmpeg } from './hooks/useFFmpeg'
import { validateVideoFile } from './utils/ffmpegHelpers'
import { isNativeAndroid, NativeGifConverter } from './utils/nativeGifConverter'

const MAX_FILE_SIZE = 250 * 1024 * 1024
const LONG_GIF_WARNING_DURATION = 20
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
const EMPTY_NATIVE_PROGRESS = {
  current: 0,
  total: 0,
  fileName: '',
  phaseLabel: '',
  currentFileProgress: 0,
  overallProgress: 0,
  completed: 0,
  failed: 0
}
const QUALITY_PRESETS = {
  compact: {
    label: '저용량',
    description: '모바일 공유용, 작은 파일 우선',
    width: 320,
    fps: 8,
    maxColors: 128,
    paletteUse: 'paletteuse=dither=bayer:bayer_scale=5'
  },
  balanced: {
    label: '기본',
    description: '품질과 용량 균형',
    width: 480,
    fps: 10,
    maxColors: 192,
    paletteUse: 'paletteuse=dither=bayer:bayer_scale=4'
  },
  quality: {
    label: '고화질',
    description: '선명도 우선, 용량 증가 가능',
    width: 720,
    fps: 15,
    maxColors: 256,
    paletteUse: 'paletteuse=dither=sierra2_4a'
  },
  fullHd: {
    label: '원본 유지',
    description: '파일별 원본 해상도 유지, 최대 1080p',
    width: 1080,
    fps: 15,
    maxColors: 256,
    paletteUse: 'paletteuse=dither=sierra2_4a'
  }
}

function formatFileSize(bytes) {
  if (!bytes) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function createGifFileName(fileName) {
  const fallbackName = 'video-to-gif'
  const trimmedName = fileName?.trim()
  if (!trimmedName) return `${fallbackName}.gif`

  const baseName = trimmedName.replace(/\.[^/.\\]+$/, '').trim() || fallbackName
  return `${baseName}.gif`
}

function normalizeGifFileName(fileName) {
  const fallbackName = 'video-to-gif.gif'
  const trimmedName = fileName.trim()
  if (!trimmedName) return fallbackName
  return trimmedName.toLowerCase().endsWith('.gif') ? trimmedName : `${trimmedName}.gif`
}

function downloadGif(gifURL, fileName) {
  if (!gifURL) return
  const link = document.createElement('a')
  link.href = gifURL
  link.download = normalizeGifFileName(fileName)
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function getVideoMetadata(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({
        duration: video.duration || 0,
        width: video.videoWidth || 0,
        height: video.videoHeight || 0
      })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('영상 길이를 확인할 수 없습니다.'))
    }
    video.src = url
  })
}

async function getVideoDuration(file) {
  const metadata = await getVideoMetadata(file)
  return metadata.duration
}

export default function App() {
  const { ffmpeg, ready, loading: ffmpegLoading, progress: ffmpegProgress, error: ffmpegError } = useFFmpeg()
  const nativeAndroid = isNativeAndroid()
  const [file, setFile] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [nativeFiles, setNativeFiles] = useState([])
  const [qualityPreset, setQualityPreset] = useState('fullHd')
  const [fps, setFps] = useState(15)
  const [width, setWidth] = useState(1080)
  const [gifURL, setGifURL] = useState('')
  const [downloadFileName, setDownloadFileName] = useState('video-to-gif.gif')
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, fileName: '' })
  const [nativeProgress, setNativeProgress] = useState(EMPTY_NATIVE_PROGRESS)
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const statusText = useMemo(() => {
    if (nativeAndroid) return 'Android 네이티브 변환 준비 완료 - 선택한 파일을 그대로 순차 변환합니다.'
    if (ffmpegError) return `FFmpeg 로드 오류: ${ffmpegError}`
    if (ffmpegLoading) return 'FFmpeg를 로드 중입니다. 잠시만 기다려주세요.'
    if (!ready) return 'FFmpeg 준비 중...'
    return 'FFmpeg 준비 완료 - 파일을 업로드하고 변환하세요.'
  }, [ffmpegError, ffmpegLoading, nativeAndroid, ready])

  const selectedPreset = QUALITY_PRESETS[qualityPreset]

  const displayGuidanceText = useMemo(() => {
    if (!file && nativeFiles.length === 0) return '기본값은 원본 비율과 해상도를 유지하되, 기기 부담을 줄이기 위해 최대 1080p까지만 변환합니다.'
    if (nativeAndroid) return 'Android에서는 선택한 파일 목록을 네이티브 FFmpeg로 순서대로 변환하고 Pictures/GIF Maker에 저장합니다.'
    if (width >= 1080) return '원본 비율을 유지하고, 원본이 1080p보다 작으면 키우지 않습니다. 변환 시간과 용량은 증가할 수 있습니다.'
    return '선택한 각 영상의 전체 길이를 자동으로 읽어 순서대로 변환합니다. 긴 영상은 휴대폰에서 느리거나 실패할 수 있습니다.'
  }, [file, nativeAndroid, nativeFiles.length, width])

  useEffect(() => {
    return () => {
      if (gifURL) URL.revokeObjectURL(gifURL)
    }
  }, [gifURL])

  useEffect(() => {
    setProgress(Math.round(ffmpegProgress * 100))
  }, [ffmpegProgress])

  useEffect(() => {
    if (!nativeAndroid) return undefined

    let progressListener
    NativeGifConverter.addListener('nativeGifProgress', (event) => {
      const currentFileProgress = Math.min(100, Math.max(0, Number(event.currentFileProgress || 0)))
      const overallProgress = Math.min(100, Math.max(0, Number(event.overallProgress || 0)))
      setProgress(currentFileProgress)
      setNativeProgress({
        current: Number(event.current || 0),
        total: Number(event.total || 0),
        fileName: event.fileName || '',
        phaseLabel: event.phaseLabel || '',
        currentFileProgress,
        overallProgress,
        completed: Number(event.completed || 0),
        failed: Number(event.failed || 0)
      })
    }).then((listener) => {
      progressListener = listener
    })

    return () => {
      progressListener?.remove()
    }
  }, [nativeAndroid])

  const handleFile = async (incomingFiles) => {
    setError('')
    setSuccessMessage('')
    const files = Array.isArray(incomingFiles) ? incomingFiles : [incomingFiles]
    const invalidFile = files.find((selectedFile) => validateVideoFile(selectedFile))
    if (invalidFile) {
      setError(`${invalidFile.name}: ${validateVideoFile(invalidFile)}`)
      return
    }
    const firstFile = files[0]
    setSelectedFiles(files)
    setNativeFiles([])
    setFile(firstFile)
    results.forEach((result) => {
      if (result.gifURL) URL.revokeObjectURL(result.gifURL)
    })
    setResults([])
    setGifURL('')
    setDownloadFileName(createGifFileName(firstFile.name))
    setBatchProgress({ current: 0, total: files.length, fileName: '' })
    const oversizedCount = files.filter((selectedFile) => selectedFile.size > MAX_FILE_SIZE).length
    if (oversizedCount > 0) {
      setError(`${oversizedCount}개 파일이 ${formatFileSize(MAX_FILE_SIZE)}를 초과했습니다. 업로드는 계속되지만 휴대폰에서는 변환이 느리거나 실패할 수 있습니다.`)
    }
  }

  const handleNativePick = async () => {
    if (!nativeAndroid || converting) return

    setError('')
    setSuccessMessage('')
    setResults([])
    setGifURL('')
    setNativeProgress(EMPTY_NATIVE_PROGRESS)

    try {
      const response = await NativeGifConverter.pickVideos()
      const pickedFiles = Array.isArray(response.files) ? response.files : []
      if (pickedFiles.length === 0) return

      setNativeFiles(pickedFiles)
      setSelectedFiles([])
      setFile({
        name: pickedFiles[0].name,
        size: pickedFiles[0].size || 0,
        type: pickedFiles[0].mimeType || 'video/mp4'
      })
      setDownloadFileName(createGifFileName(pickedFiles[0].name))
      setBatchProgress({ current: 0, total: pickedFiles.length, fileName: '' })

      const oversizedCount = pickedFiles.filter((selectedFile) => selectedFile.size > MAX_FILE_SIZE).length
      if (oversizedCount > 0) {
        setError(`${oversizedCount}개 파일이 ${formatFileSize(MAX_FILE_SIZE)}를 초과했습니다. 변환은 계속되지만 휴대폰에서는 느리거나 실패할 수 있습니다.`)
      }
    } catch (pickError) {
      setError(pickError.message || String(pickError))
    }
  }

  const handlePreset = (presetKey) => {
    const preset = QUALITY_PRESETS[presetKey]
    setQualityPreset(presetKey)
    setWidth(preset.width)
    setFps(preset.fps)
  }

  const handleConvert = async () => {
    setError('')
    setSuccessMessage('')
    if (nativeAndroid) {
      if (nativeFiles.length === 0) {
        setError('동영상 파일을 먼저 선택해주세요.')
        return
      }

      setConverting(true)
      setProgress(0)
      setNativeProgress({ ...EMPTY_NATIVE_PROGRESS, total: nativeFiles.length })
      setResults(nativeFiles.map((selectedFile, index) => ({
        id: `${Date.now()}-${index}-${selectedFile.name}`,
        sourceName: selectedFile.name,
        fileName: createGifFileName(selectedFile.name),
        status: 'queued',
        gifURL: '',
        error: ''
      })))

      try {
        const response = await NativeGifConverter.convertVideos({
          files: nativeFiles,
          width,
          fps,
          maxColors: selectedPreset.maxColors,
          paletteUse: selectedPreset.paletteUse
        })
        const outputs = Array.isArray(response.outputs) ? response.outputs : []
        const failures = Array.isArray(response.failures) ? response.failures : []
        setResults((currentResults) => currentResults.map((result) => {
          const output = outputs.find((item) => item.sourceName === result.sourceName)
          const failure = failures.find((item) => item.sourceName === result.sourceName)
          if (output) return { ...result, status: 'done', fileName: output.fileName, savedPath: output.savedPath }
          if (failure) return { ...result, status: 'failed', error: failure.message || '변환에 실패했습니다.' }
          return result
        }))
        setSuccessMessage(`${response.completed || 0}/${response.total || nativeFiles.length}개 GIF 변환이 완료되었습니다. 저장 위치: Pictures/GIF Maker`)
      } catch (nativeError) {
        setError(nativeError.message || String(nativeError))
      } finally {
        setConverting(false)
      }
      return
    }

    const filesToConvert = selectedFiles.length > 0 ? selectedFiles : file ? [file] : []
    if (filesToConvert.length === 0) {
      setError('동영상 파일을 먼저 업로드해주세요.')
      return
    }
    if (!ready) {
      setError('FFmpeg 준비가 완료될 때까지 기다려주세요.')
      return
    }
    setConverting(true)
    setProgress(0)
    setBatchProgress({ current: 0, total: filesToConvert.length, fileName: '' })
    if (gifURL) URL.revokeObjectURL(gifURL)
    setGifURL('')
    results.forEach((result) => {
      if (result.gifURL) URL.revokeObjectURL(result.gifURL)
    })
    const queuedResults = filesToConvert.map((selectedFile, index) => ({
      id: `${Date.now()}-${index}-${selectedFile.name}`,
      sourceName: selectedFile.name,
      fileName: createGifFileName(selectedFile.name),
      status: 'queued',
      gifURL: '',
      error: ''
    }))
    setResults(queuedResults)

    const convertFile = async (selectedFile, duration) => {
      const extension = selectedFile.name.split('.').pop() || 'mp4'
      const inputName = `input.${extension}`
      const paletteName = 'palette.png'
      const outputName = 'output.gif'
      ;[inputName, paletteName, outputName].forEach((name) => {
        try {
          ffmpeg.FS('unlink', name)
        } catch {
          // The file may not exist yet.
        }
      })

      try {
        ffmpeg.FS('writeFile', inputName, await fetchFile(selectedFile))

        const videoFilter = `fps=${fps},scale='if(gt(min(iw,ih),${width}),if(gt(iw,ih),-2,${width}),iw)':'if(gt(min(iw,ih),${width}),if(gt(iw,ih),${width},-2),ih)':flags=lanczos`

        await ffmpeg.run(
          '-ss', '0',
          '-t', `${duration}`,
          '-i', inputName,
          '-vf', `${videoFilter},palettegen=max_colors=${selectedPreset.maxColors}:stats_mode=diff`,
          paletteName
        )

        await ffmpeg.run(
          '-ss', '0',
          '-t', `${duration}`,
          '-i', inputName,
          '-i', paletteName,
          '-filter_complex', `${videoFilter}[x];[x][1:v]${selectedPreset.paletteUse}`,
          '-f', 'gif',
          outputName
        )

        const data = ffmpeg.FS('readFile', outputName)
        const blob = new Blob([data], { type: 'image/gif' })
        return {
          gifURL: URL.createObjectURL(blob),
          size: blob.size
        }
      } finally {
        ;[inputName, paletteName, outputName].forEach((name) => {
          try {
            ffmpeg.FS('unlink', name)
          } catch {
            // Ignore cleanup failures.
          }
        })
      }
    }

    let completedCount = 0

    try {
      for (const [index, selectedFile] of filesToConvert.entries()) {
        const resultId = queuedResults[index].id
        setBatchProgress({ current: index + 1, total: filesToConvert.length, fileName: selectedFile.name })
        setResults((currentResults) => currentResults.map((result) => (
          result.id === resultId ? { ...result, status: 'converting', error: '' } : result
        )))

        try {
          const duration = await getVideoDuration(selectedFile)

          if (!duration || duration <= 0) {
            throw new Error('변환할 영상 길이를 확인할 수 없습니다.')
          }

          if (duration > LONG_GIF_WARNING_DURATION) {
            setError(`${selectedFile.name}의 길이가 ${LONG_GIF_WARNING_DURATION}초를 초과합니다. 변환은 계속되지만 휴대폰에서는 느리거나 실패할 수 있습니다.`)
          }

          const converted = await convertFile(selectedFile, duration)
          const convertedFileName = createGifFileName(selectedFile.name)
          completedCount += 1
          setResults((currentResults) => currentResults.map((result) => (
            result.id === resultId
              ? { ...result, status: 'done', gifURL: converted.gifURL, size: converted.size, fileName: convertedFileName }
              : result
          )))
          downloadGif(converted.gifURL, convertedFileName)
          if (completedCount === 1) {
            setGifURL(converted.gifURL)
            setDownloadFileName(convertedFileName)
          }
        } catch (conversionError) {
          setResults((currentResults) => currentResults.map((result) => (
            result.id === resultId
              ? { ...result, status: 'failed', error: conversionError.message || String(conversionError) }
              : result
          )))
        }
      }

      setSuccessMessage(`${completedCount}/${filesToConvert.length}개 GIF 변환이 완료되었습니다.`)
      setTimeout(() => {
        document.getElementById('resultSection')?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } finally {
      setBatchProgress({ current: 0, total: filesToConvert.length, fileName: '' })
      setConverting(false)
    }
  }

  const handleDownload = () => {
    downloadGif(gifURL, downloadFileName)
  }

  const handleResultFileNameChange = (resultId, nextFileName) => {
    setResults((currentResults) => currentResults.map((result) => (
      result.id === resultId ? { ...result, fileName: nextFileName } : result
    )))
  }

  const handleResultDownload = (resultId) => {
    const result = results.find((item) => item.id === resultId)
    if (!result?.gifURL) return
    downloadGif(result.gifURL, result.fileName)
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 sm:mb-10">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-400">Video → GIF 변환기</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            설치형 브라우저 GIF 변환 앱
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300 sm:text-lg">
            MP4 / MOV / WEBM을 Android 앱에서 바로 GIF로 변환하세요. 여러 영상을 선택하면 전체 길이 기준으로 순서대로 변환하고 저장합니다.
          </p>
          <p className="mt-3 text-xs text-slate-500">v{APP_VERSION}</p>
        </header>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-6">
            <FileUploadCard
              onFileSelect={handleFile}
              onNativePick={handleNativePick}
              fileName={file?.name}
              fileNames={nativeAndroid ? nativeFiles.map((selectedFile) => selectedFile.name) : selectedFiles.map((selectedFile) => selectedFile.name)}
              error={error}
              maxSize={MAX_FILE_SIZE}
              disabled={converting || (!nativeAndroid && ffmpegLoading)}
              nativePicker={nativeAndroid}
            />

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-soft">
              <h2 className="mb-4 text-xl font-semibold text-white">변환 옵션</h2>
              <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {Object.entries(QUALITY_PRESETS).map(([presetKey, preset]) => (
                  <button
                    key={presetKey}
                    type="button"
                    onClick={() => handlePreset(presetKey)}
                    disabled={converting}
                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                      qualityPreset === presetKey
                        ? 'border-sky-400 bg-sky-400/10 text-white'
                        : 'border-slate-700 bg-slate-950/70 text-slate-300 hover:border-slate-500'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <span className="block text-sm font-semibold">{preset.label}</span>
                    <span className="mt-1 block text-xs text-slate-400">{preset.width}p / {preset.fps}FPS</span>
                    <span className="mt-2 block text-xs text-slate-500">{preset.description}</span>
                  </button>
                ))}
              </div>
              <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {displayGuidanceText}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>FPS 설정</span>
                    <span className="text-slate-400">{fps}</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    className="w-full accent-sky-400"
                  />
                  <p className="text-xs text-slate-500">모바일 권장 범위는 8~10FPS, 최대 15FPS입니다.</p>
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>GIF 해상도 상한 (p)</span>
                  <input
                    type="number"
                    min="160"
                    max="1080"
                    step="16"
                    value={width}
                    onChange={(e) => setWidth(Math.min(1080, Math.max(160, Number(e.target.value))))}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-400"
                  />
                  <p className="text-xs text-slate-500">원본 비율을 유지하고, 파일별 해상도를 최대 1080p까지만 제한합니다.</p>
                </label>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
                선택한 각 영상의 전체 길이를 자동으로 읽어 GIF로 변환합니다.
              </div>
            </div>
          </section>

          <aside className="min-w-0 space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-soft">
              <h2 className="mb-4 text-xl font-semibold text-white">변환 컨트롤</h2>
              <p className="mb-6 text-sm text-slate-400">변환 중에는 버튼이 비활성화됩니다. FFmpeg 로딩 상태를 확인하세요.</p>
              <div className="space-y-4">
                <button
                  onClick={handleConvert}
                  disabled={nativeAndroid ? nativeFiles.length === 0 || converting : !file || converting || ffmpegLoading || !!ffmpegError}
                  className="inline-flex w-full items-center justify-center rounded-3xl bg-sky-500 px-5 py-4 text-base font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {converting ? 'GIF 변환 중...' : nativeAndroid ? nativeFiles.length > 1 ? '선택한 GIF 순차 변환 시작' : '선택한 GIF 변환 시작' : selectedFiles.length > 1 ? 'GIF 순차 변환 시작' : 'GIF 변환 시작'}
                </button>
                <p className="rounded-3xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
                  변환 중에는 앱을 계속 열어두세요. 화면이 꺼지면 변환이 중단될 수 있습니다.
                </p>
                <div className="rounded-3xl bg-slate-950/70 p-4 text-sm text-slate-300">
                  <p className="mb-2 font-medium text-white">상태</p>
                  <p>{statusText}</p>
                  {batchProgress.current > 0 && (
                    <p className="mt-2 text-slate-400">
                      {batchProgress.current}/{batchProgress.total} 변환 중: {batchProgress.fileName}
                    </p>
                  )}
                  {nativeProgress.current > 0 && (
                    <div className="mt-2 space-y-1 text-slate-400">
                      <p>{nativeProgress.current}/{nativeProgress.total} 변환 중: {nativeProgress.fileName}</p>
                      <p>현재 단계: {nativeProgress.phaseLabel || '준비 중'}</p>
                      <p>완료 {nativeProgress.completed}개 · 실패 {nativeProgress.failed}개</p>
                    </div>
                  )}
                </div>
                <div className="rounded-3xl bg-slate-950/70 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
                    <span>현재 파일 진행률</span>
                    <span>{Math.min(progress, 100)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  {nativeAndroid && (
                    <>
                      <div className="mb-2 mt-4 flex items-center justify-between text-sm text-slate-400">
                        <span>전체 진행률</span>
                        <span>{Math.min(nativeProgress.overallProgress, 100)}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${nativeProgress.overallProgress}%` }} />
                      </div>
                    </>
                  )}
                </div>
                {successMessage && <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">{successMessage}</div>}
                {error && <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>}
              </div>
            </div>

            <div id="resultSection">
              <GifPreview
                gifURL={gifURL}
                fileName={downloadFileName}
                results={results}
                onFileNameChange={setDownloadFileName}
                onResultFileNameChange={handleResultFileNameChange}
                onDownload={handleDownload}
                onResultDownload={handleResultDownload}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
