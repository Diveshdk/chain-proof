import ffmpeg from 'fluent-ffmpeg';
import { Readable, Writable } from 'stream';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface VideoFrame {
  frameIndex: number;
  timestampSecond: number;
  buffer: Buffer;
}

export class VideoService {

  /**
   * Extract frames from a video buffer at 1 frame per second.
   * Uses FFmpeg to decode the video and extract JPEG frames.
   * Falls back gracefully if FFmpeg is not installed.
   */
  async extractFrames(videoBuffer: Buffer, fileName: string): Promise<VideoFrame[]> {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phash-'));
    const inputPath = path.join(tmpDir, fileName);

    try {
      // Write buffer to temp file
      fs.writeFileSync(inputPath, videoBuffer);

      const frames = await this.runFFmpeg(inputPath, tmpDir);
      return frames;
    } catch (err: any) {
      console.warn('FFmpeg extraction failed, returning empty frames:', err.message);
      return [];
    } finally {
      // Cleanup temp directory
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }

  private runFFmpeg(inputPath: string, tmpDir: string): Promise<VideoFrame[]> {
    return new Promise((resolve, reject) => {
      const outputPattern = path.join(tmpDir, 'frame_%04d.jpg');

      ffmpeg(inputPath)
        .videoFilters('fps=1')           // 1 frame per second
        .outputOptions([
          '-vf', 'scale=320:240',        // Scale down for speed
          '-q:v', '3',                   // JPEG quality
          '-f', 'image2',
        ])
        .output(outputPattern)
        .on('end', () => {
          try {
            const frames: VideoFrame[] = [];
            const files = fs.readdirSync(tmpDir)
              .filter(f => f.startsWith('frame_') && f.endsWith('.jpg'))
              .sort();

            for (let i = 0; i < files.length; i++) {
              const filePath = path.join(tmpDir, files[i]);
              const buffer = fs.readFileSync(filePath);
              frames.push({
                frameIndex: i,
                timestampSecond: i, // 1 fps → frameIndex = second
                buffer,
              });
            }
            resolve(frames);
          } catch (e) {
            reject(e);
          }
        })
        .on('error', (err: Error) => {
          reject(err);
        })
        .run();
    });
  }

  /**
   * Check if FFmpeg is available on the system
   */
  async isFFmpegAvailable(): Promise<boolean> {
    return new Promise(resolve => {
      ffmpeg.getAvailableCodecs((err) => {
        resolve(!err);
      });
    });
  }
}

export const videoService = new VideoService();
