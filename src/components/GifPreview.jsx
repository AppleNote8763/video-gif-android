export default function GifPreview({
  gifURL,
  fileName,
  results = [],
  onFileNameChange,
  onResultFileNameChange,
  onDownload,
  onResultDownload
}) {
  const completedResults = results.filter((result) => result.status === 'done' && (result.gifURL || result.savedPath))
  const failedResults = results.filter((result) => result.status === 'failed')
  const activeResults = results.filter((result) => result.status === 'queued' || result.status === 'converting')

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-soft">
      <h2 className="mb-4 text-xl font-semibold text-white">GIF 결과</h2>
      {results.length > 0 ? (
        <div className="space-y-5">
          {completedResults.map((result) => (
            <div key={result.id} className="space-y-4 rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="truncate text-sm font-medium text-slate-200">{result.sourceName}</p>
              {result.gifURL ? (
                <>
                  <div className="flex max-h-[42vh] min-h-[160px] w-full max-w-full min-w-0 items-center justify-center overflow-hidden rounded-3xl border border-slate-700 bg-black p-3">
                    <img src={result.gifURL} alt={`${result.sourceName} GIF preview`} className="block h-auto w-auto max-h-[38vh] max-w-full object-contain" />
                  </div>
                  <label className="block space-y-2 text-sm text-slate-300">
                    <span>저장 파일명</span>
                    <input
                      type="text"
                      value={result.fileName}
                      onChange={(event) => onResultFileNameChange(result.id, event.target.value)}
                      className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-400"
                    />
                  </label>
                  <button
                    onClick={() => onResultDownload(result.id)}
                    className="w-full rounded-3xl bg-sky-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-400"
                  >
                    GIF 다운로드
                  </button>
                </>
              ) : (
                <div className="rounded-3xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  <p>{result.fileName}</p>
                  <p className="mt-1 text-emerald-100/80">{result.savedPath || 'Pictures/GIF Maker에 저장됨'}</p>
                </div>
              )}
            </div>
          ))}
          {activeResults.length > 0 && (
            <div className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-slate-400">
              <p className="font-medium text-slate-200">변환 대기/진행 중</p>
              <div className="mt-2 space-y-1">
                {activeResults.map((result) => (
                  <p key={result.id}>{result.status === 'converting' ? '변환 중' : '대기 중'}: {result.sourceName}</p>
                ))}
              </div>
            </div>
          )}
          {failedResults.length > 0 && (
            <div className="rounded-3xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
              <p className="font-medium">실패한 파일</p>
              <div className="mt-2 space-y-1">
                {failedResults.map((result) => (
                  <p key={result.id}>{result.sourceName}: {result.error}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : gifURL ? (
        <div className="space-y-4">
          <div className="flex max-h-[52vh] min-h-[180px] w-full max-w-full min-w-0 items-center justify-center overflow-hidden rounded-3xl border border-slate-700 bg-black p-3">
            <img src={gifURL} alt="GIF preview" className="block h-auto w-auto max-h-[48vh] max-w-full object-contain" />
          </div>
          <label className="block space-y-2 text-sm text-slate-300">
            <span>저장 파일명</span>
            <input
              type="text"
              value={fileName}
              onChange={(event) => onFileNameChange(event.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-sky-400"
            />
          </label>
          <button
            onClick={onDownload}
            className="w-full rounded-3xl bg-sky-500 px-4 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            GIF 다운로드
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-400">변환이 완료되면 결과 GIF가 이곳에 표시됩니다.</p>
      )}
    </div>
  )
}
