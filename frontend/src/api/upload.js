import { api } from "./client";
import toast from "react-hot-toast";

const isUploadUrl = (url) => {
  if (!url || typeof url !== "string") return false;

  if (url.startsWith("/uploads/") || url.startsWith("uploads/")) return true;

  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/uploads/");
  } catch {
    return false;
  }
};

const extractUrl = (data) => {
  return (
    data?.data?.url ||
    data?.data?.imageUrl ||
    data?.data?.secure_url ||
    data?.data?.videoUrl ||
    data?.url ||
    data?.imageUrl ||
    data?.secure_url ||
    data?.videoUrl ||
    ""
  );
};

const extractMultipleUrls = (data) => {
  const payload = data?.data || data || {};
  const list = payload.images || payload.files || payload.urls || [];

  if (!Array.isArray(list)) return [];

  return list
    .map((item) => {
      if (typeof item === "string") return item;
      return extractUrl(item);
    })
    .filter(Boolean);
};

const assertLocalUploadUrl = (url, type = "file") => {
  if (!url) {
    throw new Error(`${type} upload failed: missing upload URL`);
  }

  if (!isUploadUrl(url)) {
    throw new Error(`${type} upload failed: file was not saved locally`);
  }

  return url;
};

const compressImage = (file, quality = 0.7) => {
  return new Promise((resolve) => {
    if (!file?.type?.startsWith("image/")) {
      resolve(file);
      return;
    }

    const img = new Image();
    const reader = new FileReader();

    reader.onload = (event) => {
      img.src = event.target?.result;
    };

    reader.onerror = () => resolve(file);
    img.onerror = () => resolve(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        resolve(file);
        return;
      }

      const maxWidth = 1200;
      const scale = Math.min(1, maxWidth / img.width);

      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }

          const safeName = file.name?.replace(/\.[^.]+$/, ".jpg") || "image.jpg";
          resolve(new File([blob], safeName, { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };

    reader.readAsDataURL(file);
  });
};

const uploadWithProgress = async ({
  url,
  formData,
  onProgress,
  retries = 2,
}) => {
  try {
    return await api.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (onProgress && event.total) {
          const percent = Math.round((event.loaded * 100) / event.total);
          onProgress(percent);
        }
      },
    });
  } catch (err) {
    const status = err?.response?.status;
    const canRetry = !status || status >= 500;

    if (retries > 0 && canRetry) {
      await new Promise((resolve) => setTimeout(resolve, 500));
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

export const uploadImage = async (file, onProgress) => {
  if (!file) {
    throw new Error("No image selected");
  }

  const compressed = await compressImage(file);

  const formData = new FormData();
  formData.append("image", compressed);

  try {
    const res = await uploadWithProgress({
      url: "/uploads/single",
      formData,
      onProgress,
    });

    const imageUrl = extractUrl(res?.data);
    return assertLocalUploadUrl(imageUrl, "Image");
  } catch (err) {
    console.error("[UPLOAD_SINGLE_ERROR]", err?.response?.data || err?.message);
    throw err;
  }
};

export const uploadMultipleImages = async (files = [], onProgress) => {
  const validFiles = Array.from(files).filter(Boolean);

  if (!validFiles.length) {
    return [];
  }

  const compressedFiles = await Promise.all(
    validFiles.map((file) => compressImage(file))
  );

  const formData = new FormData();
  compressedFiles.forEach((file) => formData.append("images", file));

  try {
    const res = await uploadWithProgress({
      url: "/uploads/multiple",
      formData,
      onProgress,
    });

    const urls = extractMultipleUrls(res?.data);
    return urls.map((url) => assertLocalUploadUrl(url, "Image"));
  } catch (err) {
    console.error("[UPLOAD_MULTIPLE_ERROR]", err?.response?.data || err?.message);

    if (err?.response?.status !== 400) {
      toast.error(err?.response?.data?.message || err?.message || "Upload failed");
    }

    throw err;
  }
};

export { extractUrl };

export const uploadProductVideo = async (file, onProgress) => {
  if (!file) {
    throw new Error("No video selected");
  }

  const formData = new FormData();
  formData.append("video", file);

  try {
    const res = await uploadWithProgress({
      url: "/uploads/video",
      formData,
      onProgress,
    });

    const videoUrl = extractUrl(res?.data);
    assertLocalUploadUrl(videoUrl, "Video");

    const payload = res?.data?.data || res?.data || {};

    return {
      url: videoUrl,
      size: payload.size || file.size,
      publicId: payload.publicId || payload.public_id || "",
      duration: payload.duration || null,
    };
  } catch (err) {
    console.error("[UPLOAD_VIDEO_ERROR]", err?.response?.data || err?.message);
    throw err;
  }
};

export const useDragDrop = (onFiles) => {
  const handleDrop = (event) => {
    event.preventDefault();

    const files = Array.from(event.dataTransfer?.files || []);
    onFiles(files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  return {
    onDrop: handleDrop,
    onDragOver: handleDragOver,
  };
};
