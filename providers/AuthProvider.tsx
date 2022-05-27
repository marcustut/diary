import * as React from "react";
import { atom, useAtom } from "jotai";

import { Loading } from "../components/Loading";
import { requestExternalImage } from "../lib/face-auth";
import Head from "next/head";
import * as faceapi from "face-api.js";
import { Button, Input, Modal, Spacer, Text } from "@nextui-org/react";
import { toast } from "react-toastify";

const PASSCODE = "piggy9464";
const CAPTURE_INTERVAL = 1000;
const OPTIONS = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
const VIDEO_DIM = { HEIGHT: 300, WIDTH: 300 };
const faces = [
  "https://firebasestorage.googleapis.com/v0/b/llly-1b79c.appspot.com/o/faces%2FScreenshot%202022-05-27%20at%203.34.24%20PM.png?alt=media&token=06634f10-2841-4118-b2f7-70cdb3947a31",
];

const userAtom = atom(
  typeof window === "undefined" ? "" : sessionStorage.getItem("user") ?? ""
);
const userAtomWithPersistence = atom<string, string, void>(
  (get) => get(userAtom),
  (get, set, newUser) => {
    set(userAtom, newUser);
    sessionStorage.setItem("user", newUser);
  }
);

type AuthProviderProps = {
  children?: React.ReactNode;
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [mounted, setMounted] = React.useState(false);
  const [ready, setReady] = React.useState(false);
  const [capture, setCapture] = React.useState("");
  const [faceMatcher, setFaceMatcher] = React.useState<faceapi.FaceMatcher>();
  const [label, setLabel] = React.useState("");
  const [camOpened, setCamOpened] = React.useState(false);
  const [captureInterval, setCaptureInterval] = React.useState<NodeJS.Timer>();
  const [modalVisible, setModalVisible] = React.useState<boolean>(false);
  const [passcode, setPasscode] = React.useState("");
  const [user, setUser] = useAtom(userAtomWithPersistence);
  const refImageRef = React.useRef<HTMLImageElement>(null);
  const refImageOverlay = React.useRef<HTMLCanvasElement>(null);
  const refVideoOverlay = React.useRef<HTMLCanvasElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const useFace = async () => {
    try {
      // setup camera
      navigator.mediaDevices
        .getUserMedia({
          video: { width: VIDEO_DIM.WIDTH, height: VIDEO_DIM.HEIGHT },
          audio: false,
        })
        .then((stream) => {
          if (videoRef.current) videoRef.current.srcObject = stream;
          setCamOpened(true);
        })
        .catch(console.error);

      const img = await requestExternalImage(faces[0]);
      const fullFaceDescription = await faceapi
        .detectSingleFace(img, OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptor();

      const _faceMatcher = new faceapi.FaceMatcher(fullFaceDescription);
      setFaceMatcher(_faceMatcher);

      faceapi.matchDimensions(refImageRef.current, refImageOverlay.current);
      // resize detection and landmarks in case displayed image is smaller than
      // original size
      const resizedResult = faceapi.resizeResults(
        fullFaceDescription,
        refImageRef.current
      );
      // draw boxes with the corresponding label as text
      const _label = _faceMatcher.findBestMatch(resizedResult.descriptor);
      const options = { label: _label.toString() };
      const drawBox = new faceapi.draw.DrawBox(
        resizedResult.detection.box,
        options
      );
      // drawBox.draw(refImageOverlay.current);
      setLabel(_label.label);
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    setMounted(true);

    Promise.all([
      // load models
      faceapi.nets.ssdMobilenetv1.load("/models"),
      faceapi.nets.faceLandmark68Net.load("/models"),
      faceapi.nets.faceRecognitionNet.load("/models"),
    ])
      .then(([stream, , ,]) => {
        setReady(true);
      })
      .catch(console.error);

    // run an interval to keep cature image
    const interval = setInterval(() => {
      if (!canvasRef.current) return;
      canvasRef.current
        .getContext("2d")
        .drawImage(
          videoRef.current,
          0,
          0,
          VIDEO_DIM.WIDTH,
          VIDEO_DIM.HEIGHT / 2
        );
      setCapture(canvasRef.current.toDataURL("image/png"));
    }, CAPTURE_INTERVAL);
    setCaptureInterval(interval);

    return () => clearInterval(interval);
  }, [mounted, ready]);

  React.useEffect(() => {
    if (!ready || !faceMatcher) return;

    const verifyFace = async () => {
      const img = document.createElement("img");
      img.src = capture;
      const detection = await faceapi
        .detectSingleFace(img, OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptor();

      // handle no face
      if (!detection) {
        console.error("no face detected");
        return;
      }

      faceapi.matchDimensions(videoRef.current, refVideoOverlay.current);
      const resizedResult = faceapi.resizeResults(detection, videoRef.current);

      const _label = faceMatcher.findBestMatch(resizedResult.descriptor);
      const option = { label: _label.toString() };
      const drawBox = new faceapi.draw.DrawBox(
        resizedResult.detection.box,
        option
      );
      drawBox.draw(refVideoOverlay.current);

      if (_label.label === label) {
        toast.success("Face matched! ✅");
        clearInterval(captureInterval);
        setUser("Marcus Lee");
      }
    };

    verifyFace().then().catch(console.error);
  }, [capture, ready]);

  if (!mounted || !ready) return <Loading />;

  return user.length > 0 ? (
    <>{children}</>
  ) : (
    <>
      <Head>
        <title>Sign In</title>
      </Head>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <div style={{ position: "relative", display: "none" }}>
          <img
            ref={refImageRef}
            src={faces[0]}
            style={{ height: VIDEO_DIM.HEIGHT, width: VIDEO_DIM.WIDTH }}
          />
          <canvas
            ref={refImageOverlay}
            style={{ position: "absolute", top: 0, left: 0 }}
          />
        </div>
        <div
          style={{
            position: "relative",
            display: !camOpened ? "none" : "block",
          }}
        >
          <video ref={videoRef} autoPlay />
          <canvas
            ref={refVideoOverlay}
            style={{ position: "absolute", top: 0, left: 0 }}
          />
        </div>
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <Button
          color="success"
          style={{ background: "#262626", fontWeight: 700 }}
          onClick={() => useFace()}
        >
          <svg
            width="1.5em"
            height="1.5em"
            viewBox="0 0 24 24"
            style={{ marginRight: "0.5rem" }}
          >
            <path
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M7 3H5a2 2 0 0 0-2 2v2m14-4h2a2 2 0 0 1 2 2v2m-5 1v2M8 8v2m1 6s1 1 3 1s3-1 3-1m-3-8v5h-1m-4 8H5a2 2 0 0 1-2-2v-2m14 4h2a2 2 0 0 0 2-2v-2"
            ></path>
          </svg>
          Login with Face
        </Button>
        <Spacer y={0.5} />
        <Button
          style={{ background: "#262626", fontWeight: 700 }}
          onClick={() => setModalVisible(true)}
        >
          <svg
            width="1.5em"
            height="1.5em"
            viewBox="0 0 24 24"
            style={{ marginRight: "0.5rem" }}
          >
            <path
              fill="currentColor"
              d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2s-2 .9-2 2s.9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1c1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"
            ></path>
          </svg>
          Login with Passcode
        </Button>
      </div>

      <Modal open={modalVisible} onClose={() => setModalVisible(false)}>
        <Modal.Header>
          <Text h3>Enter Passcode</Text>
        </Modal.Header>
        <Modal.Body>
          <Input
            type="password"
            clearable
            bordered
            placeholder="Enter passcode here..."
            onChange={(e) => setPasscode(e.target.value)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button
            color="default"
            style={{ width: "100%" }}
            onClick={() => {
              if (passcode.trim() === PASSCODE) {
                toast.success("Passcode valid ✅");
                setUser("Marcus Lee");
              } else toast.error("Passcode incorrect ❌");
            }}
          >
            Submit
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
