import { api } from "./client";

/**
 * ======================
 * HELPERS
 * ======================
 */

// Compress image (basic canvas compression)
const compressImage = (file, quality = 0.7) => {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(file);

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Resize if too large
      const maxWidth = 1200;
      const scale = Math.min(1, maxWidth / img.width);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };

    reader.readAsDataURL(file);
  });
};

// Extract URL safely
const extractUrl = (data) =>
  data?.file?.url || data?.url || data?.imageUrl || "";

// ======================
// CORE UPLOAD WITH PROGRESS + RETRY
// ======================
const uploadWithProgress = async ({
  url,
  formData,
  onProgress,
  retries = 2,
}) => {
  try {
    const res = await api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },

      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          const percent = Math.round((e.loaded * 100) / e.total);
          onProgress(percent);
        }
      },
    });

    return res;
  } catch (err) {
    if (retries > 0) {
      return uploadWithProgress({
        url,
        formData,
        onProgress,
        retries: retries - 1,
      });
    }
    throw err;
  }
};

// ======================
// SINGLE IMAGE
// ======================
export const uploadImage = async (file, onProgress) => {
  const compressed = await compressImage(file);

  const formData = new FormData();
  formData.append("files", compressed);

  const res = await uploadWithProgress({
    url: "/uploads/single",
    formData,
    onProgress,
  });

  return res.data.url || res.data.data?.url;
};

// ======================
// MULTIPLE IMAGES
// ======================
export const uploadMultipleImages = async (files, onProgress) => {
  const compressedFiles = await Promise.all(
    files.map((f) => compressImage(f))
  );

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const res = await api.post("/uploads/multiple", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return res.data.urls;
};

// ======================
// PRODUCT VIDEO UPLOAD
// ======================
export const uploadProductVideo = async (file, onProgress) => {
  const formData = new FormData();
  formData.append("video", file);

  const data = await uploadWithProgress({
    url: "/uploads/video",
    formData,
    onProgress,
  });

  const url = extractUrl(data);
  if (!url) throw new Error("Video upload failed");

  return url;
};

/**
 * ======================
 * DRAG & DROP HANDLER
 * ======================
 */
export const useDragDrop = (onFiles) => {
  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    onFiles(files);
  };

  const handleDragOver = (e) => e.preventDefault();

  return {
    onDrop: handleDrop,
    onDragOver: handleDragOver,
  };
};