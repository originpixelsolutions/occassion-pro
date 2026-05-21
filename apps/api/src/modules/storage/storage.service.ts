import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export type StorageBucket = 'uploads' | 'avatars' | 'documents' | 'floor-plans' | 'badges'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly s3: S3Client
  private readonly bucketName: string
  private readonly publicUrl: string

  constructor(private readonly config: ConfigService) {
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: this.config.get<string>('CLOUDFLARE_R2_ENDPOINT'),
      credentials: {
        accessKeyId: this.config.get<string>('CLOUDFLARE_R2_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get<string>('CLOUDFLARE_R2_SECRET_ACCESS_KEY', ''),
      },
    })
    this.bucketName = this.config.get<string>('CLOUDFLARE_R2_BUCKET', 'occasionpro')
    this.publicUrl = this.config.get<string>('CLOUDFLARE_R2_PUBLIC_URL', '')
  }

  private buildKey(bucket: StorageBucket, tenantId: string, filename: string): string {
    return `${bucket}/${tenantId}/${filename}`
  }

  async getUploadUrl(options: {
    bucket: StorageBucket
    tenantId: string
    filename: string
    contentType: string
    expiresIn?: number
  }): Promise<{ upload_url: string; key: string; public_url: string }> {
    const key = this.buildKey(options.bucket, options.tenantId, options.filename)
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: options.contentType,
    })
    const upload_url = await getSignedUrl(this.s3, command, {
      expiresIn: options.expiresIn ?? 3600,
    })
    const public_url = `${this.publicUrl}/${key}`
    return { upload_url, key, public_url }
  }

  async getDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucketName, Key: key })
    return getSignedUrl(this.s3, command, { expiresIn })
  }

  async deleteFile(key: string): Promise<void> {
    try {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }))
    } catch (err: any) {
      this.logger.error(`Failed to delete ${key}: ${err.message}`)
    }
  }

  async uploadBuffer(options: {
    bucket: StorageBucket
    tenantId: string
    filename: string
    buffer: Buffer
    contentType: string
  }): Promise<{ key: string; public_url: string }> {
    const key = this.buildKey(options.bucket, options.tenantId, options.filename)
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: options.buffer,
        ContentType: options.contentType,
      }),
    )
    const public_url = `${this.publicUrl}/${key}`
    return { key, public_url }
  }

  getPublicUrl(key: string): string {
    return `${this.publicUrl}/${key}`
  }
}
