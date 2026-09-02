import { useFrame } from "@react-three/fiber";

export default function CameraRig({ pointerRef }) {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;

    // Smooth idle movement
    camera.position.x +=
      ((pointerRef.current.x * 0.6) +
        Math.sin(t * 0.15) * 0.25 -
        camera.position.x) * 0.04;

    camera.position.y +=
      (2.8 +
        pointerRef.current.y * 0.35 +
        Math.sin(t * 0.25) * 0.12 -
        camera.position.y) * 0.04;

    camera.position.z +=
      (8 +
        Math.sin(t * 0.2) * 0.18 -
        camera.position.z) * 0.04;

    camera.lookAt(0, -1, -8);
  });

  return null;
}