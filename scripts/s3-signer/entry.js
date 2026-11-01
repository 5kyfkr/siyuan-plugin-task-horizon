import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

globalThis.__tmCalendarS3Signer = Object.freeze({
    async presignPut(target, contentType, cacheControl) {
        const client = new S3Client({
            endpoint: target.endpoint,
            region: target.region,
            forcePathStyle: target.forcePathStyle,
            credentials: { accessKeyId: target.accessKeyId, secretAccessKey: target.secretAccessKey },
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
        });
        try {
            return await getSignedUrl(client, new PutObjectCommand({
                Bucket: target.bucket, Key: target.key, ContentType: contentType, CacheControl: cacheControl,
            }), { expiresIn: 900 });
        } finally {
            client.destroy();
        }
    },
});
