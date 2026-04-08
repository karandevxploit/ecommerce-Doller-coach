import { api } from "./client";

export const uploadImage = async (file) => {
  const formData = new FormData();
  formData.append("image", file);
  const data = await api.post("/upload/single", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.imageUrl || "";
};

export const uploadMultipleImages = async (files) => {
  const formData = new FormData();
  files.forEach((file) => formData.append("images", file));
  const data = await api.post("/upload/multiple", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.images || [];
};

export const uploadProductVideo = async (file) => {
  const formData = new FormData();
  formData.append("video", file);
  const data = await api.post("/upload/video", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data?.videoUrl || "";
};
