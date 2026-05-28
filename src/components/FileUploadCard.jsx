export default function FileUploadCard({
  onFileSelect,
  onNativePick,
  fileName,
  fileNames = [],
  error,
  maxSize,
  disabled,
  nativePicker = false
}) {
  const handleFiles = (files) => {
    if (files.length > 0) {
      onFileSelect(Array.from(files))
    }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    handleFiles(event.dataTransfer.files)
  }

  const handleChange = (event) => {
    handleFiles(event.target.files)
  }

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-soft">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-white">파일 업로드</h2>
        <p className="mt-2 text-sm text-slate-400">
          MP4 / MOV / WEBM 영상을 업로드하거나 드래그 앤 드롭하세요. 최대 {Math.round(maxSize / 1024 / 1024)}MB.
        </p>
      </div>
      <div
        role={nativePicker ? 'button' : undefined}
        tabIndex={nativePicker ? 0 : undefined}
        onClick={nativePicker ? onNativePick : undefined}
        onKeyDown={nativePicker ? (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onNativePick?.()
          }
        } : undefined}
        onDrop={handleDrop}
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={(event) => event.preventDefault()}
        className="group relative flex min-h-[220px] flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-slate-700 bg-slate-950/70 px-5 py-10 text-center transition hover:border-sky-400"
      >
        <div className="flex items-center justify-center text-slate-400">
          <div className="rounded-full border border-slate-700 bg-slate-900 p-4 text-2xl text-sky-400">⬆</div>
        </div>
        <div className="mt-5 space-y-3">
          <p className="text-base font-medium text-white">
            {nativePicker ? '탭해서 동영상 파일을 선택하세요' : '파일을 드래그하거나 클릭하여 업로드하세요'}
          </p>
          <p className="text-sm text-slate-500">MP4, MOV, WEBM 파일을 지원합니다.</p>
        </div>
        {!nativePicker && (
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            multiple
            onChange={handleChange}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        )}
      </div>
      {fileName && (
        <div className="mt-5 rounded-3xl bg-slate-950 px-4 py-3 text-sm text-slate-200">
          <span className="font-medium text-slate-100">선택된 파일:</span> {fileName}
        </div>
      )}
      {fileNames.length > 1 && (
        <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-300">
          <p className="mb-2 font-medium text-slate-100">{fileNames.length}개 파일이 선택되었습니다.</p>
          <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
            {fileNames.map((name, index) => (
              <p key={`${name}-${index}`} className="truncate text-slate-400">{name}</p>
            ))}
          </div>
        </div>
      )}
      {error && <div className="mt-4 rounded-3xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
    </div>
  )
}
