import * as React from "react";
import { atom, useAtom } from "jotai";

import { Loading } from "../components/Loading";
import { requestExternalImage } from "../lib/face-auth";
import Head from "next/head";
import * as faceapi from "face-api.js";
import { Button, Input, Modal, Spacer, Text, theme } from "@nextui-org/react";
import { toast } from "react-toastify";

const PASSCODES = ["piggy9464", "llly0429"];
const CAPTURE_INTERVAL = 1000;
// const OPTIONS = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 });
const OPTIONS = new faceapi.TinyFaceDetectorOptions({
  inputSize: 512,
  scoreThreshold: 0.5,
});
const VIDEO_DIM = { HEIGHT: 300, WIDTH: 300 };
const BOX_COLORS = ["red", "blue", "yellow", "orange", "pink"];
const FACES = [
  "https://firebasestorage.googleapis.com/v0/b/llly-1b79c.appspot.com/o/faces%2FScreenshot%202022-05-27%20at%203.34.24%20PM.png?alt=media&token=06634f10-2841-4118-b2f7-70cdb3947a31",
  "https://firebasestorage.googleapis.com/v0/b/llly-1b79c.appspot.com/o/faces%2Fprofile3.jpeg?alt=media&token=850e9fe7-7c4a-4c19-956a-19f33047375d",

  "https://firebasestorage.googleapis.com/v0/b/llly-1b79c.appspot.com/o/faces%2Fphoto1653673775.jpeg?alt=media&token=7a551e77-e3ff-4616-b45d-570efe17b437",
  "https://firebasestorage.googleapis.com/v0/b/llly-1b79c.appspot.com/o/faces%2Fphoto1653673775%20(2).jpeg?alt=media&token=b1ccb5e4-1335-4322-aacf-48a8127080a8",
  "https://firebasestorage.googleapis.com/v0/b/llly-1b79c.appspot.com/o/faces%2Fphoto1653673775%20(1).jpeg?alt=media&token=f8c9c522-e943-4c37-8ec4-d91ea35d4b3d",
  "https://firebasestorage.googleapis.com/v0/b/llly-1b79c.appspot.com/o/faces%2FScreenshot%202022-05-28%20at%201.50.23%20AM.png?alt=media&token=03f7c760-8516-47a2-8a8c-c56e966618d6",
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
  const [faceMatchers, setFaceMatchers] = React.useState<faceapi.FaceMatcher[]>(
    []
  );
  const [labels, setLabels] = React.useState<string[]>([]);
  const [camOpened, setCamOpened] = React.useState(false);
  const [captureInterval, setCaptureInterval] = React.useState<NodeJS.Timer>();
  const [modalVisible, setModalVisible] = React.useState<boolean>(false);
  const [passcode, setPasscode] = React.useState("");
  const [faceDetected, setFaceDetected] = React.useState(false);
  const [user, setUser] = useAtom(userAtomWithPersistence);
  const refVideoOverlay = React.useRef<HTMLCanvasElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const useFace = async () => {
    // show loading indicator
    const id = toast.loading("Initialising camera...");

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

      const imgs = await Promise.all(
        FACES.map(async (face) => await requestExternalImage(face))
      );
      const fullFaceDescriptions = await Promise.all(
        imgs.map(
          async (img) =>
            await faceapi
              .detectSingleFace(img, OPTIONS)
              .withFaceLandmarks()
              .withFaceDescriptor()
        )
      );
      const _faceMatchers = fullFaceDescriptions.map(
        (fullFaceDescription) => new faceapi.FaceMatcher(fullFaceDescription)
      );
      setFaceMatchers(_faceMatchers);
      const resizedResults = fullFaceDescriptions.map(
        (fullFaceDescription, idx) =>
          faceapi.resizeResults(fullFaceDescription, imgs[idx])
      );
      resizedResults.forEach(({ descriptor }, idx) => {
        const label = _faceMatchers[idx].findBestMatch(descriptor).label;
        setLabels((old) => [...old, label]);
      });

      // show success indicator
      toast.update(id, {
        render: "Camera initialised!",
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });
    } catch (err) {
      // show failed indicator
      toast.update(id, {
        render: "Failed to initialise camera",
        type: "error",
        isLoading: false,
        autoClose: 3000,
      });
      console.error(err);
    }
  };

  React.useEffect(() => {
    setMounted(true);

    // skip if already has user
    if (user !== "") {
      setReady(true);
      return;
    }

    toast.promise(
      // load models
      Promise.all([
        faceapi.nets.tinyFaceDetector.load("/models"),
        faceapi.nets.faceLandmark68Net.load("/models"),
        faceapi.nets.faceRecognitionNet.load("/models"),
      ])
        .then(() => setReady(true))
        .catch(console.error),
      {
        error: "Error loading ML models",
        pending: "Loading ML models...",
        success: "Successfully loaded ML models",
      },
      {
        autoClose: 3000,
      }
    );

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
  }, []);

  React.useEffect(() => {
    if (!ready || faceMatchers.length === 0 || labels.length === 0) return;

    const verifyFace = async () => {
      const img = document.createElement("img");
      img.src = capture;
      const result = await faceapi
        .detectSingleFace(img, OPTIONS)
        .withFaceLandmarks()
        .withFaceDescriptor();

      // handle no face
      if (!result) {
        setFaceDetected(false);
        return;
      }

      setFaceDetected(true);

      faceapi.matchDimensions(videoRef.current, refVideoOverlay.current);
      const { descriptor, detection } = faceapi.resizeResults(
        result,
        videoRef.current
      );

      for (let i = 0; i < faceMatchers.length; i++) {
        const label = faceMatchers[i].findBestMatch(descriptor);
        const drawBox = new faceapi.draw.DrawBox(detection.box, {
          label: label.toString(),
          boxColor: BOX_COLORS[Math.floor(Math.random() * BOX_COLORS.length)],
        });
        drawBox.draw(refVideoOverlay.current);

        if (labels.includes(label.label)) {
          toast.success("Face matched!");
          clearInterval(captureInterval);
          setUser("Marcus Lee");
        }
      }
    };

    verifyFace().then().catch(console.error);
  }, [capture]);

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
        <div
          style={{
            position: "relative",
            display: !camOpened ? "none" : "block",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            style={{
              borderRadius: theme.radii.xl.value,
              marginBottom: theme.space[4].value,
            }}
          />
          <Text
            css={{ textAlign: "center", marginBottom: theme.space[7].value }}
          >
            {!faceDetected ? "No face detected" : "Face detected!"}
          </Text>
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

      <Modal
        open={modalVisible}
        onClose={() => setModalVisible(false)}
        css={{ margin: "$0 $8" }}
      >
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
              if (PASSCODES.includes(passcode.trim())) {
                toast.success("Passcode valid");
                setUser("Marcus Lee");
              } else toast.error("Passcode incorrect");
            }}
          >
            Submit
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
