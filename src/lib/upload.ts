import { cloudinary } from './cloudinary';

export async function uploadImageToCloudinary(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'heirlooms' },
      (err, result) => {
        if (err || !result?.secure_url) return reject(err || new Error('No result'));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
