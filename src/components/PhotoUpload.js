"use client";

import { useState } from "react";
import { db } from "@/lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export default function PhotoUpload({ userId, routeId, onUploadComplete }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 파일 크기 체크 (10MB 이하)
    if (file.size > 10 * 1024 * 1024) {
      alert("10MB 이하 사진만 업로드 가능합니다");
      return;
    }

    // 미리보기
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      // ✅ Cloudinary 업로드 (카드 불필요, 무료)
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "upload_preset",
        process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET
      );
      formData.append("folder", `plogging/${userId}`);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData }
      );

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const imageUrl = data.secure_url;
      setUploadedUrl(imageUrl);

      // ✅ Firestore route 문서에 사진 URL 저장
      if (routeId) {
        await updateDoc(doc(db, "routes", routeId), {
          photoURL: imageUrl,
        });
      }

      onUploadComplete?.(imageUrl);
    } catch (err) {
      console.error("업로드 실패:", err);
      alert("업로드 중 오류가 발생했습니다: " + err.message);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setUploadedUrl(null);
  };

  return (
    <div className="mt-3">
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="플로깅 사진"
            className="w-full h-40 object-cover rounded-xl"
          />
          <div className="absolute top-2 right-2 flex gap-1">
            {uploading ? (
              <span className="bg-yellow-400 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                업로드 중...
              </span>
            ) : (
              <>
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                  ✅ 완료
                </span>
                <button
                  onClick={handleRemove}
                  className="bg-red-500 text-white text-xs px-2 py-1 rounded-full"
                >
                  ✕
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <label className={`w-full border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${uploading ? "border-green-300 bg-green-50" : "border-gray-200 active:bg-gray-50"}`}>
          <span className="text-3xl">{uploading ? "⏳" : "📸"}</span>
          <p className="text-sm font-medium text-gray-600">
            {uploading ? "업로드 중..." : "쓰레기 사진 첨부하기"}
          </p>
          <p className="text-xs text-gray-400">JPG/PNG · 10MB 이하</p>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}