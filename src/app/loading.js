"use client";
import { useState } from "react";
import { Recycle } from "lucide-react";

export default function Loading() {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center z-[999]">
      {imgError ? (
        <div className="mb-6 text-center flex items-center gap-2">
          <Recycle className="w-7 h-7 text-olive-600" strokeWidth={1.8} style={{ color: "#6B7F3B" }} />
          <p className="text-2xl font-black text-green-600">오백원의 행복</p>
        </div>
      ) : (
        <img
          src="https://res.cloudinary.com/dqlvm572h/image/upload/w_400,q_auto,f_auto/Intro_Logo_fuj1kt.png"
          alt="오백원의 행복"
          className="w-36 h-auto object-contain mb-8"
          onError={() => setImgError(true)}
        />
      )}
      <div className="flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <p className="text-xs text-gray-400 mt-4 flex items-center gap-1">즐거운 플로깅, 깨끗한 지구 <Recycle className="w-3 h-3 inline" strokeWidth={1.8} style={{ color: "#6B7F3B" }} /></p>
    </div>
  );
}
