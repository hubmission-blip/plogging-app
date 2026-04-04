export default function Loading() {
  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col items-center justify-center z-[999]">
      <img
        src="https://gyea.kr/wp/wp-content/uploads/2025/12/500_subtitle_c.png"
        alt="오백원의 행복"
        className="h-12 w-auto object-contain mb-6"
      />
      <div className="flex gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-green-500 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <p className="text-xs text-gray-400 mt-4">즐거운 플로깅, 깨끗한 지구 🌿</p>
    </div>
  );
}
