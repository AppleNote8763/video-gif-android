import { useEffect, useMemo, useState } from 'react'
import { fetchFile } from '@ffmpeg/ffmpeg'
import FileUploadCard from './components/FileUploadCard'
import VideoPreview from './components/VideoPreview'
import GifPreview from './components/GifPreview'
import { useFFmpeg } from './hooks/useFFmpeg'
import { validateVideoFile } from './utils/ffmpegHelpers'
import { formatSeconds } from './utils/formatTime'

const MAX_FILE_SIZE = 250 * 1024 * 1024
const LONG_GIF_WARNING_DURATION = 20
const RECOMMENDED_GIF_DURATION = 10
const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
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

function getVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration || 0)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('영상 길이를 확인할 수 없습니다.'))
    }
    video.src = url
  })
}

export default function App() {
  const { ffmpeg, ready, loading: ffmpegLoading, progress: ffmpegProgress, error: ffmpegError } = useFFmpeg()
  const [file, setFile] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [videoURL, setVideoURL] = useState('')
  const [videoDuration, setVideoDuration] = useState(0)
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(0)
  const [qualityPreset, setQualityPreset] = useState('balanced')
  const [fps, setFps] = useState(10)
  const [width, setWidth] = useState(480)
  const [gifURL, setGifURL] = useState('')
  const [downloadFileName, setDownloadFileName] = useState('video-to-gif.gif')
  const [converting, setConverting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, fileName: '' })
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const statusText = useMemo(() => {
    if (ffmpegError) return `FFmpeg 로드 오류: ${ffmpegError}`
    if (ffmpegLoading) return 'FFmpeg를 로드 중입니다. 잠시만 기다려주세요.'
    if (!ready) return 'FFmpeg 준비 중...'
    return 'FFmpeg 준비 완료 - 파일을 업로드하고 변환하세요.'
  }, [ffmpegError, ffmpegLoading, ready])

  const selectedPreset = QUALITY_PRESETS[qualityPreset]
  const clipDuration = Math.max(0, endTime - startTime)

  const displayGuidanceText = useMemo(() => {
    if (!file) return '모바일에서는 3~10초, 320~480px, 8~10FPS 설정이 안정적입니다.'
    if (selectedFiles.length > 1) return '여러 파일은 각 영상의 전체 길이를 자동으로 읽어 순서대로 변환합니다. 긴 영상은 휴대폰에서 느리거나 실패할 수 있습니다.'
    if (clipDuration > LONG_GIF_WARNING_DURATION) return `${LONG_GIF_WARNING_DURATION}초를 초과하는 GIF는 휴대폰에서 변환이 느리거나 실패할 수 있습니다. 화질과 프레임은 선택한 설정 그대로 유지됩니다.`
    if (clipDuration > RECOMMENDED_GIF_DURATION) return '10초를 넘는 GIF는 용량이 커질 수 있습니다. 모바일에서는 저용량 또는 기본 프리셋을 권장합니다.'
    return 'GIF 용량이 적당합니다. 공유용이면 저용량 또는 기본 프리셋을 사용하세요.'
  }, [clipDuration, file, selectedFiles.length])

  useEffect(() => {
    return () => {
      if (videoURL) URL.revokeObjectURL(videoURL)
      if (gifURL) URL.revokeObjectURL(gifURL)
    }
  }, [videoURL, gifURL])

  useEffect(() => {
    setProgress(Math.round(ffmpegProgress * 100))
  }, [ffmpegProgress])

  useEffect(() => {
    if (file && videoDuration > 0 && endTime === 0) {
      setEndTime(videoDuration)
    }
  }, [file, videoDuration, endTime])

  const handleFile = (incomingFiles) => {
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
    setFile(firstFile)
    results.forEach((result) => {
      if (result.gifURL) URL.revokeObjectURL(result.gifURL)
    })
    setResults([])
    setGifURL('')
    setDownloadFileName(createGifFileName(firstFile.name))
    setVideoDuration(0)
    setStartTime(0)
    setEndTime(0)
    setBatchProgress({ current: 0, total: files.length, fileName: '' })
    const url = URL.createObjectURL(firstFile)
    if (videoURL) URL.revokeObjectURL(videoURL)
    setVideoURL(url)
    const oversizedCount = files.filter((selectedFile) => selectedFile.size > MAX_FILE_SIZE).length
    if (oversizedCount > 0) {
      setError(`${oversizedCount}개 파일이 ${formatFileSize(MAX_FILE_SIZE)}를 초과했습니다. 업로드는 계속되지만 휴대폰에서는 변환이 느리거나 실패할 수 있습니다.`)
    }
  }

  const handleMetadata = (event) => {
    const duration = Math.floor(event.target.duration || 0)
    setVideoDuration(duration)
    if (endTime === 0 || endTime > duration) {
      setEndTime(duration)
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
    const filesToConvert = selectedFiles.length > 0 ? selectedFiles : file ? [file] : []
    if (filesToConvert.length === 0) {
      setError('동영상 파일을 먼저 업로드해주세요.')
      return
    }
    if (!ready) {
      setError('FFmpeg 준비가 완료될 때까지 기다려주세요.')
      return
    }
    if (filesToConvert.length === 1 && (startTime < 0 || endTime <= 0 || startTime >= endTime)) {
      setError('시작 시간과 종료 시간을 올바르게 설정해주세요.')
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

    const convertFile = async (selectedFile, range) => {
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

        const videoFilter = `fps=${fps},scale=${width}:-1:flags=lanczos`
        const start = range?.start ?? startTime
        const end = range?.end ?? endTime

        await ffmpeg.run(
          '-ss', `${start}`,
          '-to', `${end}`,
          '-i', inputName,
          '-vf', `${videoFilter},palettegen=max_colors=${selectedPreset.maxColors}:stats_mode=diff`,
          paletteName
        )

        await ffmpeg.run(
          '-ss', `${start}`,
          '-to', `${end}`,
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
          const range = filesToConvert.length > 1
            ? { start: 0, end: await getVideoDuration(selectedFile) }
            : { start: startTime, end: endTime }

          if (!range.end || range.end <= range.start) {
            throw new Error('변환할 영상 구간을 확인할 수 없습니다.')
          }

          if (range.end > LONG_GIF_WARNING_DURATION) {
            setError(`${selectedFile.name}의 길이가 ${LONG_GIF_WARNING_DURATION}초를 초과합니다. 변환은 계속되지만 휴대폰에서는 느리거나 실패할 수 있습니다.`)
          }

          const converted = await convertFile(selectedFile, range)
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
            MP4 / MOV / WEBM을 Android 앱에서 바로 GIF로 변환하세요. 빠른 변환, 미리보기, 다운로드를 지원합니다.
          </p>
          <p className="mt-3 text-xs text-slate-500">v{APP_VERSION}</p>
        </header>

        <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-6">
            <FileUploadCard
              onFileSelect={handleFile}
              fileName={file?.name}
              fileNames={selectedFiles.map((selectedFile) => selectedFile.name)}
              error={error}
              maxSize={MAX_FILE_SIZE}
              disabled={converting || ffmpegLoading}
            />

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-soft">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">영상 미리보기</h2>
                  <p className="text-sm text-slate-400">업로드한 영상의 재생 시간을 확인하고 값을 조정하세요.</p>
                </div>
                <div className="rounded-2xl bg-slate-800 px-4 py-2 text-sm text-slate-300">
                  {videoDuration ? `총 길이 ${formatSeconds(videoDuration)}` : '영상 등록 후 길이 확인'}
                </div>
              </div>
              <VideoPreview previewURL={videoURL} onLoadedMetadata={handleMetadata} />
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-soft">
              <h2 className="mb-4 text-xl font-semibold text-white">변환 옵션</h2>
              <div className="mb-5 grid gap-3 sm:grid-cols-3">
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
                    <span className="mt-1 block text-xs text-slate-400">{preset.width}px / {preset.fps}FPS</span>
                    <span className="mt-2 block text-xs text-slate-500">{preset.description}</span>
                  </button>
                ))}
              </div>
              <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                {displayGuidanceText}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span>시작 시간 (초)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={startTime}
                    disabled={selectedFiles.length > 1}
                    onChange={(e) => setStartTime(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span>종료 시간 (초)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={endTime}
                    disabled={selectedFiles.length > 1}
                    onChange={(e) => setEndTime(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </label>
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
                  <span>GIF 폭 (px)</span>
                  <input
                    type="number"
                    min="160"
                    max="720"
                    step="16"
                    value={width}
                    onChange={(e) => setWidth(Math.min(720, Math.max(160, Number(e.target.value))))}
                    className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-400"
                  />
                  <p className="text-xs text-slate-500">모바일에서는 320~480px를 권장합니다.</p>
                </label>
              </div>
              <div className="mt-4 rounded-2xl bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
                {selectedFiles.length > 1
                  ? '여러 파일 선택 시 각 영상의 전체 길이를 자동으로 변환합니다.'
                  : `선택 구간: ${formatSeconds(clipDuration)}`}
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
                  disabled={!file || converting || ffmpegLoading || !!ffmpegError}
                  className="inline-flex w-full items-center justify-center rounded-3xl bg-sky-500 px-5 py-4 text-base font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
                >
                  {converting ? 'GIF 변환 중...' : selectedFiles.length > 1 ? 'GIF 순차 변환 시작' : 'GIF 변환 시작'}
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
                </div>
                <div className="rounded-3xl bg-slate-950/70 p-4">
                  <div className="mb-2 flex items-center justify-between text-sm text-slate-400">
                    <span>진행률</span>
                    <span>{Math.min(progress, 100)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-sky-400 transition-all" style={{ width: `${progress}%` }} />
                  </div>
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
