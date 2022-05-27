import * as faceapi from "face-api.js";

const SSD_MOBILENETV1 = "ssd_mobilenetv1";
const TINY_FACE_DETECTOR = "tiny_face_detector";

let selectedFaceDetector = SSD_MOBILENETV1;

// ssd_mobilenetv1 options
let minConfidence = 0.5;

// tiny_face_detector options
let inputSize = 512;
let scoreThreshold = 0.5;

export const requestExternalImage = async (imageUrl: string) => {
  const res = await fetch(imageUrl, { method: "get" });
  if (!(res.status < 400)) {
    console.error(res.status + " : " + (await res.text()));
    throw new Error("failed to fetch image from url: " + imageUrl);
  }

  let blob;
  try {
    blob = await res.blob();
    return await faceapi.bufferToImage(blob);
  } catch (e) {
    console.error("received blob:", blob);
    console.error("error:", e);
    throw new Error("failed to load image from url: " + imageUrl);
  }
};
