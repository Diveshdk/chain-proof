import crypto from 'crypto';
import sharp from 'sharp';

// ─── pHash Constants ──────────────────────────────────────
const HASH_SIZE = 8;     // 8x8 = 64-bit hash
const DCT_SIZE = 32;     // resize to 32x32 before DCT

export class HashService {

  // ─── SHA-256 (exact duplicate check) ────────────────────
  generateFileHash(fileBuffer: Buffer): string {
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  verifyHash(data: Buffer | string, expectedHash: string): boolean {
    const actual = Buffer.isBuffer(data)
      ? this.generateFileHash(data)
      : this.generateContentHash(data);
    return actual === expectedHash;
  }

  // ─── Real Perceptual Hash (pHash via DCT) ────────────────
  /**
   * Generates a 64-bit perceptual hash for image data.
   * Algorithm:
   *   1. Resize to 32x32 grayscale
   *   2. Apply 2D DCT
   *   3. Take top-left 8x8 of DCT (lowest frequencies)
   *   4. Compute median of that 8x8 block
   *   5. Build 64-bit binary string: 1 if pixel > median, else 0
   *   6. Return as 16-char hex
   */
  async generatePHash(imageBuffer: Buffer): Promise<string> {
    try {
      // Step 1: Resize to 32x32 grayscale and get raw pixel bytes
      const { data } = await sharp(imageBuffer)
        .resize(DCT_SIZE, DCT_SIZE, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pixels: number[] = Array.from(data);

      // Step 2: Build 32x32 grid
      const matrix: number[][] = [];
      for (let y = 0; y < DCT_SIZE; y++) {
        matrix.push(pixels.slice(y * DCT_SIZE, (y + 1) * DCT_SIZE));
      }

      // Step 3: Apply 2D DCT
      const dct = this.applyDCT2D(matrix);

      // Step 4: Extract top-left 8x8 block (DC component = lowest frequencies)
      const dctBlock: number[] = [];
      for (let y = 0; y < HASH_SIZE; y++) {
        for (let x = 0; x < HASH_SIZE; x++) {
          dctBlock.push(dct[y][x]);
        }
      }

      // Step 5: Compute median
      const sorted = [...dctBlock].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];

      // Step 6: Build binary hash
      const bits = dctBlock.map(v => (v > median ? 1 : 0));

      // Step 7: Convert bits to 16-char hex string
      let hex = '';
      for (let i = 0; i < 64; i += 4) {
        const nibble = (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
        hex += nibble.toString(16);
      }
      return hex;
    } catch (err: any) {
      // Fallback: MD5 prefix if sharp fails (e.g. unsupported format)
      console.warn('pHash fallback (sharp error):', err.message);
      return crypto.createHash('md5').update(imageBuffer).digest('hex').substring(0, 16);
    }
  }

  // ─── 2D DCT (Discrete Cosine Transform) ─────────────────
  private applyDCT2D(matrix: number[][]): number[][] {
    const N = matrix.length;
    const out: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));

    for (let u = 0; u < N; u++) {
      for (let v = 0; v < N; v++) {
        let sum = 0;
        for (let x = 0; x < N; x++) {
          for (let y = 0; y < N; y++) {
            sum +=
              matrix[x][y] *
              Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N)) *
              Math.cos(((2 * y + 1) * v * Math.PI) / (2 * N));
          }
        }
        const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
        const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
        out[u][v] = (2 / N) * cu * cv * sum;
      }
    }
    return out;
  }

  // ─── Hamming Distance (between two pHash hex strings) ───
  hammingDistance(hash1: string, hash2: string): number {
    const bin1 = this.hexToBinary(hash1);
    const bin2 = this.hexToBinary(hash2);
    const len = Math.min(bin1.length, bin2.length);
    let distance = 0;
    for (let i = 0; i < len; i++) {
      if (bin1[i] !== bin2[i]) distance++;
    }
    return distance;
  }

  hexToBinary(hex: string): string {
    return hex
      .split('')
      .map(c => parseInt(c, 16).toString(2).padStart(4, '0'))
      .join('');
  }

  // ─── 4x4 Spatial Tiling (16 Regions + 1 Global) ────────
  /**
   * Generates a global pHash plus 16 regional pHashes in a 4x4 grid.
   * This allows detection of small crops or partial reuse (sensitivity: 1/16th).
   */
  async generateRegionalHashes(imageBuffer: Buffer): Promise<string[]> {
    const hashes: string[] = [];

    // 1. Global Hash (the original whole image)
    const globalHash = await this.generatePHash(imageBuffer);
    hashes.push(globalHash);

    try {
      // 2. Fragmented Hashes (4x4 Grid = 16 Tiles)
      const metadata = await sharp(imageBuffer).metadata();
      const width = metadata.width || 1000;
      const height = metadata.height || 1000;
      
      const tileWidth = Math.floor(width / 4);
      const tileHeight = Math.floor(height / 4);

      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const left = col * tileWidth;
          const top = row * tileHeight;
          
          // Ensure we don't exceed dimensions on last tile
          const extractWidth = (col === 3) ? width - left : tileWidth;
          const extractHeight = (row === 3) ? height - top : tileHeight;

          const regionBuffer = await sharp(imageBuffer)
            .extract({ left, top, width: extractWidth, height: extractHeight })
            .toBuffer();
          
          const regionHash = await this.generatePHash(regionBuffer);
          hashes.push(regionHash);
        }
      }
    } catch (err: any) {
      console.warn('Regional pHash failed, returning only global:', err.message);
    }

    return hashes;
  }
}

export const hashService = new HashService();
