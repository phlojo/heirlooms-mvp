import { cloudinary } from './cloudinary';

export async function uploadImageToCloudinary(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'heirlooms', resource_type: 'image' },
      (err, result) => {
        if (err || !result?.secure_url) return reject(err || new Error('No result'));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

// NEW: handles audio (Cloudinary treats audio under resource_type 'video')
export async function uploadAudioToCloudinary(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'heirlooms/audio', resource_type: 'video', format: 'mp3' },
      (err, result) => {
        if (err || !result?.secure_url) return reject(err || new Error('No result'));
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
