import type { CameraCalibration, CameraMetric } from "../types";
import { scoreCameraSignals } from "./cameraCalibration";

type FaceLandmarker = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => {
    faceLandmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
    faceBlendshapes?: Array<{ categories?: Array<{ score: number; categoryName: string }> }>;
  };
  close: () => void;
};

export class CameraMetricSource {
  private stream?: MediaStream;
  private landmarker?: FaceLandmarker;
  private detectorReady = false;

  constructor(private calibration?: CameraCalibration) {}

  setCalibration(calibration?: CameraCalibration): void {
    this.calibration = calibration;
  }

  async start(video: HTMLVideoElement): Promise<void> {
    try {
      this.landmarker = await createFaceLandmarker();
      this.detectorReady = true;
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      video.srcObject = this.stream;
      await video.play();
    } catch (error) {
      this.landmarker?.close();
      this.landmarker = undefined;
      this.detectorReady = false;
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = undefined;
      throw error;
    }
  }

  sample(video: HTMLVideoElement, timestampMs = performance.now()): CameraMetric {
    if (!this.landmarker || !this.detectorReady) {
      throw new Error("Camera attention detector is not ready.");
    }
    const result = this.landmarker.detectForVideo(video, timestampMs);
    const faces = result.faceLandmarks ?? [];
    if (faces.length === 0) return emptyMetric(true);

    const primaryFace = faces[0];
    const nose = primaryFace[1] ?? primaryFace[Math.floor(primaryFace.length / 2)];
    const leftCheek = primaryFace[234];
    const rightCheek = primaryFace[454];
    const faceCenterX = ((leftCheek?.x ?? 0.35) + (rightCheek?.x ?? 0.65)) / 2;
    const faceWidth = Math.max(0.01, Math.abs((rightCheek?.x ?? 0.65) - (leftCheek?.x ?? 0.35)));
    const headTurn = Math.abs((nose?.x ?? faceCenterX) - faceCenterX) / faceWidth;
    const blendshapes = result.faceBlendshapes?.[0]?.categories ?? [];
    const eyeLookSideOrUp = Math.max(
      blendshapeScore(blendshapes, "eyeLookOutLeft"),
      blendshapeScore(blendshapes, "eyeLookOutRight"),
      blendshapeScore(blendshapes, "eyeLookUpLeft"),
      blendshapeScore(blendshapes, "eyeLookUpRight"),
    );
    const eyeLookDown = Math.max(
      blendshapeScore(blendshapes, "eyeLookDownLeft"),
      blendshapeScore(blendshapes, "eyeLookDownRight"),
    );
    const confidence = clamp(faceWidth / 0.18, 0, 1);
    const eyesVisible = primaryFace.length > 280;
    const scored = scoreCameraSignals({
      confidence,
      headTurn,
      eyeLookSideOrUp,
      eyeLookDown,
    }, this.calibration);

    return {
      present: true,
      face_count: faces.length,
      attention_score: round2(scored.attentionScore),
      looking_away: scored.lookingAway,
      eyes_visible: eyesVisible,
      confidence: round2(confidence),
      detector_ready: this.detectorReady,
      head_turn: round3(headTurn),
      eye_look_side_or_up: round3(eyeLookSideOrUp),
      eye_look_down: round3(eyeLookDown),
    };
  }

  stop(): void {
    this.landmarker?.close();
    this.landmarker = undefined;
    this.detectorReady = false;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }
}

async function createFaceLandmarker(): Promise<FaceLandmarker> {
  const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks("/wasm");
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath: "/models/face_landmarker.task",
      delegate: "CPU",
    },
    runningMode: "VIDEO",
    numFaces: 2,
    outputFaceBlendshapes: true,
  }) as Promise<FaceLandmarker>;
}

function emptyMetric(detectorReady = false): CameraMetric {
  return {
    present: false,
    face_count: 0,
    attention_score: 0,
    looking_away: false,
    eyes_visible: false,
    confidence: 0,
    detector_ready: detectorReady,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function blendshapeScore(
  categories: Array<{ score: number; categoryName: string }>,
  name: string,
): number {
  return categories.find((category) => category.categoryName === name)?.score ?? 0;
}
