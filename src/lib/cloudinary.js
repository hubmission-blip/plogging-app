export async function uploadToCloudinary(file) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloudName) throw new Error("Cloudinary 설정이 누락되었습니다. 관리자에게 문의하세요.");
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "plogging");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: fd }
  );
  if (!res.ok) throw new Error("이미지 업로드 실패");
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "이미지 업로드 실패");
  return data.secure_url;
}
