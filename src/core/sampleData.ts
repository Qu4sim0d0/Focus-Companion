import type { ActivityWatchEvent, CameraMetric, WindowEventData } from "../types";

export function sampleWindowEvents(date: string): ActivityWatchEvent<WindowEventData>[] {
  return [
    event(date, "09:00", 90, { app: "Code", title: "focus-companion/src/App.tsx" }),
    event(date, "10:30", 20, { app: "Safari", title: "YouTube - recommended" }),
    event(date, "10:50", 95, { app: "Terminal", title: "npm run test" }),
    event(date, "13:00", 70, { app: "Code", title: "ActivityWatch client" }),
    event(date, "14:10", 30, { app: "Messages", title: "Chat" }),
    event(date, "14:40", 120, { app: "Code", title: "Report generation" }),
  ];
}

export function sampleCameraEvents(date: string): ActivityWatchEvent<CameraMetric>[] {
  const events: ActivityWatchEvent<CameraMetric>[] = [];
  for (let hour = 9; hour < 17; hour += 1) {
    for (let minute = 0; minute < 60; minute += 5) {
      const distracted = hour === 10 && minute >= 30 && minute < 50;
      const away = hour === 12 || (hour === 15 && minute < 15);
      events.push({
        timestamp: `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000`,
        duration: 0,
        data: {
          present: !away,
          face_count: away ? 0 : 1,
          attention_score: away ? 0 : distracted ? 0.35 : 0.86,
          looking_away: distracted,
          eyes_visible: !away,
          confidence: away ? 0 : 0.9,
        },
      });
    }
  }
  return events;
}

function event(date: string, time: string, durationMinutes: number, data: WindowEventData): ActivityWatchEvent<WindowEventData> {
  return {
    timestamp: `${date}T${time}:00.000`,
    duration: durationMinutes * 60,
    data,
  };
}
