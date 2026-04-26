// Hook do streamu live (kamera / capture card / OBS Virtual Camera)
import { useCallback, useEffect, useRef, useState } from "react";

export interface VideoDeviceInfo {
  deviceId: string;
  label: string;
}

interface UseLiveStreamReturn {
  devices: VideoDeviceInfo[];
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string) => void;
  stream: MediaStream | null;
  status: "idle" | "loading-devices" | "ready" | "streaming" | "paused" | "error";
  error: string | null;
  startStream: () => Promise<void>;
  stopStream: () => void;
  pauseStream: () => void;
  resumeStream: () => void;
  refreshDevices: () => Promise<void>;
}

// Próbujemy znaleźć "OBS" — heurystyka domyślnego wyboru
function pickDefaultDevice(devices: VideoDeviceInfo[]): string | null {
  if (devices.length === 0) return null;
  const obs = devices.find((d) => /obs/i.test(d.label));
  if (obs) return obs.deviceId;
  return devices[0].deviceId;
}

export function useLiveStream(): UseLiveStreamReturn {
  const [devices, setDevices] = useState<VideoDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<UseLiveStreamReturn["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const refreshDevices = useCallback(async () => {
    setStatus("loading-devices");
    setError(null);
    try {
      // Wymagamy uprawnienia, żeby labels były wypełnione — krótka próba getUserMedia
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        probe.getTracks().forEach((t) => t.stop());
      } catch {
        // Ignoruj — i tak spróbujemy enumerate; labels mogą być puste
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      const list: VideoDeviceInfo[] = all
        .filter((d) => d.kind === "videoinput")
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Kamera ${i + 1}` }));
      setDevices(list);
      if (list.length === 0) {
        setStatus("error");
        setError("Nie znaleziono kamer. Podłącz capture card lub webcam i odśwież.");
        return;
      }
      setSelectedDeviceId((prev) => prev ?? pickDefaultDevice(list));
      setStatus("ready");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Nie udało się odczytać listy urządzeń.");
    }
  }, []);

  const startStream = useCallback(async () => {
    if (!selectedDeviceId) {
      setError("Wybierz kamerę.");
      return;
    }
    setError(null);
    try {
      // Zatrzymaj poprzedni stream jeśli istnieje
      streamRef.current?.getTracks().forEach((t) => t.stop());

      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: selectedDeviceId },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = s;
      setStream(s);
      setStatus("streaming");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("error");
      if (/permission|NotAllowed/i.test(msg)) {
        setError("Nie udało się uzyskać dostępu. Sprawdź uprawnienia przeglądarki do kamery.");
      } else if (/NotFound/i.test(msg)) {
        setError("Wybrana kamera niedostępna. Odśwież listę urządzeń.");
      } else {
        setError(`Błąd kamery: ${msg}`);
      }
    }
  }, [selectedDeviceId]);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    setStatus("ready");
  }, []);

  const pauseStream = useCallback(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = false));
    setStatus("paused");
  }, []);

  const resumeStream = useCallback(() => {
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = true));
    setStatus("streaming");
  }, []);

  // Cleanup przy unmount — zwolnij kamerę
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  return {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    stream,
    status,
    error,
    startStream,
    stopStream,
    pauseStream,
    resumeStream,
    refreshDevices,
  };
}
