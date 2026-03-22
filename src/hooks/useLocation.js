"use client";
import { useState, useEffect, useRef } from "react";

export function useLocation() {
  const [path, setPath] = useState([]);
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const watchIdRef = useRef(null);

  const startTracking = () => {
    if (!navigator.geolocation) {
      alert("이 브라우저는 GPS를 지원하지 않습니다.");
      return;
    }
    setIsTracking(true);
    setPath([]);
    setDistance(0);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPath((prev) => {
          if (prev.length > 0) {
            const d = calcDistance(prev[prev.length - 1], newPoint);
            setDistance((dist) => dist + d);
          }
          return [...prev, newPoint];
        });
      },
      (err) => console.error("위치 오류:", err),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    setIsTracking(false);
    return path;
  };

  return { path, isTracking, distance, startTracking, stopTracking };
}

function calcDistance(p1, p2) {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}