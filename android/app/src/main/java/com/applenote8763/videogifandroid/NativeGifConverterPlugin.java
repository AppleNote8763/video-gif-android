package com.applenote8763.videogifandroid;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.ReturnCode;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;

import androidx.activity.result.ActivityResult;
import org.json.JSONObject;

@CapacitorPlugin(name = "NativeGifConverter")
public class NativeGifConverterPlugin extends Plugin {
    private static final String OUTPUT_DIRECTORY = Environment.DIRECTORY_PICTURES + "/GIF Maker";

    @PluginMethod
    public void pickVideos(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("video/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickVideosResult");
    }

    @ActivityCallback
    private void pickVideosResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("files", new JSArray()));
            return;
        }

        try {
            List<Uri> uris = collectUris(result.getData());
            JSArray files = new JSArray();
            for (Uri uri : uris) {
                try {
                    getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Exception ignored) {
                }
                files.put(createFileObject(uri));
            }
            call.resolve(new JSObject().put("files", files));
        } catch (Exception error) {
            call.reject(error.getMessage(), error);
        }
    }

    @PluginMethod
    public void convertVideos(PluginCall call) {
        JSArray fileArray = call.getArray("files", new JSArray());
        if (fileArray.length() == 0) {
            call.reject("변환할 동영상 파일이 없습니다.");
            return;
        }

        getBridge().execute(() -> {
            JSArray outputs = new JSArray();
            JSArray failures = new JSArray();
            int completed = 0;
            int failed = 0;
            int total = fileArray.length();

            for (int index = 0; index < total; index++) {
                JSObject fileObject;
                try {
                    fileObject = JSObject.fromJSONObject((JSONObject) fileArray.get(index));
                } catch (Exception error) {
                    failed += 1;
                    continue;
                }

                String sourceName = fileObject.getString("name", "video-" + (index + 1) + ".mp4");
                try {
                    final int fileIndex = index;
                    Uri sourceUri = Uri.parse(fileObject.getString("uri"));
                    int current = index + 1;
                    double duration = fileObject.optDouble("duration", 0.0);
                    if (duration <= 0) duration = readDurationSeconds(sourceUri);

                    notifyProgress(current, total, sourceName, "입력 파일 준비 중", 0, index, completed, failed);
                    File inputFile = copyToCache(sourceUri, sourceName);
                    File outputFile = new File(getContext().getCacheDir(), makeBaseName(sourceName) + ".gif");
                    if (outputFile.exists()) outputFile.delete();

                    int width = call.getInt("width", 480);
                    int fps = call.getInt("fps", 10);
                    int maxColors = call.getInt("maxColors", 192);
                    String paletteUse = call.getString("paletteUse", "paletteuse=dither=bayer:bayer_scale=4");
                    String filters = String.format(
                            Locale.US,
                            "fps=%d,scale='if(gt(min(iw,ih),%d),if(gt(iw,ih),-2,%d),iw)':'if(gt(min(iw,ih),%d),if(gt(iw,ih),%d,-2),ih)':flags=lanczos",
                            fps,
                            width,
                            width,
                            width,
                            width
                    );
                    String filterComplex = String.format(
                            Locale.US,
                            "[0:v]%s,split[x][z];[z]palettegen=max_colors=%d:stats_mode=diff[p];[x][p]%s",
                            filters,
                            maxColors,
                            paletteUse
                    );

                    final double videoDuration = Math.max(0.1, duration);
                    final int completedAtStart = completed;
                    final int failedAtStart = failed;
                    notifyProgress(current, total, sourceName, "GIF 파일 생성 중", 5, index, completed, failed);
                    CountDownLatch latch = new CountDownLatch(1);
                    final FFmpegSession[] sessionHolder = new FFmpegSession[1];
                    FFmpegKit.executeWithArgumentsAsync(
                            new String[]{
                                    "-y",
                                    "-i", inputFile.getAbsolutePath(),
                                    "-filter_complex", filterComplex,
                                    "-f", "gif",
                                    outputFile.getAbsolutePath()
                            },
                            sessionResult -> {
                                sessionHolder[0] = sessionResult;
                                latch.countDown();
                            },
                            log -> {
                            },
                            statistics -> {
                                int progress = Math.min(95, Math.max(5, (int) Math.round((statistics.getTime() / 1000.0) / videoDuration * 95)));
                                notifyProgress(current, total, sourceName, "GIF 파일 생성 중", progress, fileIndex, completedAtStart, failedAtStart);
                            }
                    );
                    latch.await();
                    FFmpegSession session = sessionHolder[0];

                    if (session == null || !ReturnCode.isSuccess(session.getReturnCode())) {
                        throw new Exception("FFmpeg 변환 실패: " + (session == null ? "세션을 만들 수 없습니다." : session.getFailStackTrace()));
                    }

                    notifyProgress(current, total, sourceName, "Pictures/GIF Maker 저장 중", 96, index, completed, failed);
                    String gifName = makeBaseName(sourceName) + ".gif";
                    String savedPath = saveGifToPictures(outputFile, gifName);
                    completed += 1;
                    notifyProgress(current, total, sourceName, "완료", 100, index, completed, failed);

                    JSObject output = new JSObject();
                    output.put("sourceName", sourceName);
                    output.put("fileName", gifName);
                    output.put("savedPath", savedPath);
                    outputs.put(output);

                    inputFile.delete();
                    outputFile.delete();
                } catch (Exception error) {
                    failed += 1;
                    notifyProgress(index + 1, total, sourceName, "실패", 100, index, completed, failed);
                    JSObject failure = new JSObject();
                    failure.put("sourceName", sourceName);
                    failure.put("message", error.getMessage() == null ? String.valueOf(error) : error.getMessage());
                    failures.put(failure);
                }
            }

            JSObject response = new JSObject();
            response.put("total", total);
            response.put("completed", completed);
            response.put("failed", failed);
            response.put("outputs", outputs);
            response.put("failures", failures);
            call.resolve(response);
        });
    }

    private List<Uri> collectUris(Intent data) {
        List<Uri> uris = new ArrayList<>();
        if (data.getClipData() != null) {
            for (int i = 0; i < data.getClipData().getItemCount(); i++) {
                uris.add(data.getClipData().getItemAt(i).getUri());
            }
        } else if (data.getData() != null) {
            uris.add(data.getData());
        }
        return uris;
    }

    private JSObject createFileObject(Uri uri) {
        JSObject object = new JSObject();
        object.put("uri", uri.toString());
        object.put("name", queryDisplayName(uri));
        object.put("size", querySize(uri));
        object.put("mimeType", getContext().getContentResolver().getType(uri));
        object.put("duration", readDurationSeconds(uri));
        int[] size = readVideoSize(uri);
        object.put("width", size[0]);
        object.put("height", size[1]);
        return object;
    }

    private String queryDisplayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) return cursor.getString(index);
            }
        } catch (Exception ignored) {
        }
        return "video.mp4";
    }

    private long querySize(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (index >= 0) return cursor.getLong(index);
            }
        } catch (Exception ignored) {
        }
        return 0;
    }

    private double readDurationSeconds(Uri uri) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(getContext(), uri);
            String durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            return durationMs == null ? 0 : Long.parseLong(durationMs) / 1000.0;
        } catch (Exception ignored) {
            return 0;
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
            }
        }
    }

    private int[] readVideoSize(Uri uri) {
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(getContext(), uri);
            String width = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH);
            String height = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT);
            return new int[]{
                    width == null ? 0 : Integer.parseInt(width),
                    height == null ? 0 : Integer.parseInt(height)
            };
        } catch (Exception ignored) {
            return new int[]{0, 0};
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
            }
        }
    }

    private File copyToCache(Uri uri, String sourceName) throws Exception {
        File output = new File(getContext().getCacheDir(), "input-" + System.nanoTime() + "." + extensionFor(sourceName));
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             OutputStream outputStream = new FileOutputStream(output)) {
            if (input == null) throw new Exception("동영상 파일을 열 수 없습니다.");
            byte[] buffer = new byte[1024 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                outputStream.write(buffer, 0, read);
            }
        }
        return output;
    }

    private String saveGifToPictures(File gifFile, String fileName) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/gif");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, OUTPUT_DIRECTORY);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.put(MediaStore.Images.Media.IS_PENDING, 1);
        }

        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
        if (uri == null) throw new Exception("GIF 저장 위치를 만들 수 없습니다.");

        try (InputStream input = new FileInputStream(gifFile);
             OutputStream output = resolver.openOutputStream(uri)) {
            if (output == null) throw new Exception("GIF 저장 파일을 열 수 없습니다.");
            byte[] buffer = new byte[1024 * 1024];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentValues publish = new ContentValues();
            publish.put(MediaStore.Images.Media.IS_PENDING, 0);
            resolver.update(uri, publish, null, null);
        }

        return "Pictures/GIF Maker/" + fileName;
    }

    private void notifyProgress(int current, int total, String fileName, String phaseLabel, int currentFileProgress, int completedBeforeCurrent, int completed, int failed) {
        JSObject event = new JSObject();
        event.put("current", current);
        event.put("total", total);
        event.put("fileName", fileName);
        event.put("phaseLabel", phaseLabel);
        event.put("currentFileProgress", currentFileProgress);
        event.put("overallProgress", Math.min(100, Math.round(((current - 1) + currentFileProgress / 100.0) / Math.max(1, total) * 100)));
        event.put("completed", completed);
        event.put("failed", failed);
        notifyListeners("nativeGifProgress", event);
    }

    private String makeBaseName(String fileName) {
        String clean = fileName == null ? "video-to-gif" : fileName.trim();
        int dotIndex = clean.lastIndexOf('.');
        if (dotIndex > 0) clean = clean.substring(0, dotIndex);
        clean = clean.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        return clean.isEmpty() ? "video-to-gif" : clean;
    }

    private String extensionFor(String fileName) {
        int dotIndex = fileName == null ? -1 : fileName.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == fileName.length() - 1) return "mp4";
        return fileName.substring(dotIndex + 1).replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.US);
    }

}
