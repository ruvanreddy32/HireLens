import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StoredFile {
  fileKey: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  filePath?: string;
  driver: 's3' | 'local';
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir: string;
  private readonly s3Client: S3Client | null = null;
  private readonly bucket: string | null = null;
  private readonly region: string;
  public readonly isS3Enabled: boolean = false;
  
  //inspects the .env file and configures s3 or local storage accordingly
  constructor() {
    this.uploadDir = path.resolve(process.cwd(), 'uploads', 'resumes');

    const bucket = process.env.AWS_S3_BUCKET;
    const region = (process.env.AWS_REGION || 'us-east-1').trim();
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const endpoint = process.env.AWS_S3_ENDPOINT; // For MinIO or Cloudflare R2
    const driver = (process.env.STORAGE_DRIVER || '').toLowerCase();

    this.region = region;

    // Enable S3 if AWS_S3_BUCKET is set and driver is not explicitly forced to 'local'
    if (bucket && driver !== 'local') {
      try {
        const clientConfig: any = { region };

        if (accessKeyId && secretAccessKey) {
          clientConfig.credentials = {
            accessKeyId,
            secretAccessKey,
          };
        }

        if (endpoint) {
          clientConfig.endpoint = endpoint;
          clientConfig.forcePathStyle = true; // Required for MinIO / local testing
        }

        this.s3Client = new S3Client(clientConfig);
        this.bucket = bucket;
        this.isS3Enabled = true;

        this.logger.log(
          `StorageService initialized with AWS S3 driver (Bucket: "${bucket}", Region: "${region}"${
            endpoint ? `, Endpoint: "${endpoint}"` : ''
          })`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to initialize S3 client: ${err.message}. Falling back to local filesystem driver.`,
        );
        this.isS3Enabled = false;
      }
    } else {
      this.logger.log(
        `StorageService initialized with local filesystem driver (${this.uploadDir}). Set AWS_S3_BUCKET in .env to activate AWS S3 / MinIO.`,
      );
    }
  }

  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Save a file buffer to S3 or local disk
   */
  async saveFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string = 'application/pdf',
  ): Promise<StoredFile> {
    const sanitizedBase = path
      .basename(originalName)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 80);

    const uniqueId = randomUUID();
    const rawFileName = `${uniqueId}-${sanitizedBase}`;
    const fileSize = buffer.length;

    // ── Driver 1: AWS S3 / MinIO ──────────────────────────────────
    if (this.isS3Enabled && this.s3Client && this.bucket) {
      const s3Key = `resumes/${rawFileName}`;

      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: buffer,
          ContentType: mimeType,
          Metadata: {
            originalName: sanitizedBase,
            uploadedAt: new Date().toISOString(),
          },
        }),
      );

      const fileUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${s3Key}`;
      this.logger.log(`Uploaded resume to S3: s3://${this.bucket}/${s3Key} (${fileSize} bytes)`);

      return {
        fileKey: s3Key,
        fileName: originalName,
        fileUrl,
        fileSize,
        driver: 's3',
      };
    }

    // ── Driver 2: Local Filesystem Fallback ───────────────────────
    this.ensureDirectoryExists(this.uploadDir);
    const filePath = path.join(this.uploadDir, rawFileName);

    await fs.promises.writeFile(filePath, buffer);
    const fileUrl = `/uploads/resumes/${rawFileName}`;

    this.logger.log(`Saved resume to local disk: ${rawFileName} (${fileSize} bytes)`);

    return {
      fileKey: rawFileName,
      fileName: originalName,
      fileUrl,
      fileSize,
      filePath,
      driver: 'local',
    };
  }

  /**
   * Generate an AWS S3 pre-signed URL for secure, temporary document viewing (default: 15 mins)
   */
  async getPresignedViewUrl(fileKey: string, expiresInSeconds: number = 900): Promise<string> {
    if (this.isS3Enabled && this.s3Client && this.bucket) {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        ResponseContentType: 'application/pdf',
        ResponseContentDisposition: 'inline',
      });

      return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    }

    // Local fallback: relative URL
    const safeKey = path.basename(fileKey);
    return `/uploads/resumes/${safeKey}`;
  }

  /**
   * Get absolute path for local file
   */
  getFilePath(fileKey: string): string {
    const safeKey = path.basename(fileKey);
    const filePath = path.join(this.uploadDir, safeKey);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`File not found: ${fileKey}`);
    }
    return filePath;
  }

  /**
   * Check if file exists in S3 or local disk
   */
  async fileExists(fileKey: string): Promise<boolean> {
    if (this.isS3Enabled && this.s3Client && this.bucket) {
      try {
        await this.s3Client.send(
          new HeadObjectCommand({
            Bucket: this.bucket,
            Key: fileKey,
          }),
        );
        return true;
      } catch {
        return false;
      }
    }

    const safeKey = path.basename(fileKey);
    const filePath = path.join(this.uploadDir, safeKey);
    return fs.existsSync(filePath);
  }

  /**
   * Get readable stream for binary file serving
   */
  async getFileStream(fileKey: string): Promise<Readable> {
    if (this.isS3Enabled && this.s3Client && this.bucket) {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
        }),
      );

      if (!response.Body) {
        throw new NotFoundException(`Resume object body not found in S3: ${fileKey}`);
      }

      return response.Body as Readable;
    }

    const filePath = this.getFilePath(fileKey);
    return fs.createReadStream(filePath);
  }

  /**
   * Delete a file from S3 or local disk
   */
  async deleteFile(fileKey: string): Promise<void> {
    try {
      if (this.isS3Enabled && this.s3Client && this.bucket) {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: fileKey,
          }),
        );
        this.logger.log(`Deleted S3 object: ${fileKey}`);
        return;
      }

      const safeKey = path.basename(fileKey);
      const filePath = path.join(this.uploadDir, safeKey);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
        this.logger.log(`Deleted local file: ${fileKey}`);
      }
    } catch (err) {
      this.logger.warn(`Failed to delete file ${fileKey}: ${err.message}`);
    }
  }
}
