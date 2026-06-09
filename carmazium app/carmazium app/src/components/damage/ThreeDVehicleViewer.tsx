import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import * as THREE from 'three';
// eslint-disable-next-line import/no-unresolved
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Asset } from 'expo-asset';
import { Canvas, useFrame, useLoader } from '@react-three/fiber/native';
import { Colors } from '../../constants/colors';
import { FontFamily } from '../../constants/typography';
import { DamageZone3D } from './damageZones';

// ─── Bundled, pre-compressed generic vehicle model (~2.4MB) ───────────────────
// Quantised geometry (KHR_mesh_quantization — natively supported by three.js,
// no WASM decoder needed) + downsized JPEG textures, so it can ship in the app
// bundle instead of streaming a 20-40MB source GLB at runtime.
const MODEL_MODULE = require('../../assets/3d/vehicle.glb');

const TARGET_SIZE = 5; // normalised longest-dimension, matches the web viewer

// ─── Suspense-friendly resource cache for the local model URI ─────────────────
// `useLoader` needs a stable string URL synchronously; expo-asset resolution is
// async, so we wrap it in a tiny throw-a-promise resource the way Suspense expects.
let modelUriResult: string | null = null;
let modelUriError: unknown = null;
let modelUriPromise: Promise<void> | null = null;

function readModelUri(): string {
  if (modelUriResult) return modelUriResult;
  if (modelUriError) throw modelUriError;
  if (!modelUriPromise) {
    modelUriPromise = Asset.fromModule(MODEL_MODULE)
      .downloadAsync()
      .then((asset) => {
        modelUriResult = asset.localUri ?? asset.uri;
      })
      .catch((err) => {
        modelUriError = err;
      });
  }
  throw modelUriPromise;
}

// ─── Normalised vehicle model ──────────────────────────────────────────────────
// GLBs are often modelled at arbitrary scale; measure the bounding box and
// scale + recentre so the car is always TARGET_SIZE units long, sat on Y = 0.

function VehicleModel() {
  const uri = readModelUri();
  const gltf = useLoader(GLTFLoader, uri);
  const innerRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    inner.scale.set(1, 1, 1);
    inner.position.set(0, 0, 0);

    const box = new THREE.Box3().setFromObject(inner);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) return;

    const scale = TARGET_SIZE / maxDim;
    inner.scale.setScalar(scale);

    const scaledBox = new THREE.Box3().setFromObject(inner);
    const center = scaledBox.getCenter(new THREE.Vector3());
    inner.position.x -= center.x;
    inner.position.z -= center.z;
    inner.position.y -= scaledBox.min.y;
  }, [gltf]);

  return (
    <group ref={innerRef}>
      <primitive object={gltf.scene} />
    </group>
  );
}

// ─── Hotspot marker — a camera-facing ring that raycasts for taps ─────────────

interface HotspotProps {
  zone: DamageZone3D;
  isMarked: boolean;
  isSelected: boolean;
  onPress: (label: string) => void;
}

function Hotspot({ zone, isMarked, isSelected, onPress }: HotspotProps) {
  const ref = useRef<THREE.Group>(null);

  useFrame(({ camera }) => {
    if (ref.current) ref.current.quaternion.copy(camera.quaternion);
  });

  const color = isSelected ? '#DC1F26' : isMarked ? '#F59E0B' : '#FFFFFF';
  const fillOpacity = isSelected || isMarked ? 0.85 : 0.45;
  const radius = isSelected ? 0.16 : 0.13;

  return (
    <group position={zone.position}>
      <group ref={ref}>
        <mesh
          onPointerDown={(e: any) => e.stopPropagation()}
          onClick={(e: any) => {
            e.stopPropagation();
            onPress(zone.label);
          }}
        >
          <circleGeometry args={[radius, 24]} />
          <meshBasicMaterial color={color} transparent opacity={fillOpacity} depthTest={false} />
        </mesh>
        <mesh>
          <ringGeometry args={[radius, radius + 0.035, 24]} />
          <meshBasicMaterial color="#FFFFFF" transparent opacity={0.7} depthTest={false} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Rotation rig — drag horizontally to spin, auto-rotates when idle ─────────

const AUTO_ROTATE_SPEED = 0.22; // radians / second
const DRAG_SENSITIVITY = 0.012; // radians / pixel

interface RotationRigProps {
  children: React.ReactNode;
}

function RotationRig({ children }: RotationRigProps) {
  const groupRef = useRef<THREE.Group>(null);
  const rotationY = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);

  useFrame((_, delta) => {
    if (!dragging.current) {
      rotationY.current += delta * AUTO_ROTATE_SPEED;
    }
    if (groupRef.current) groupRef.current.rotation.y = rotationY.current;
  });

  const getX = (e: any) => e.nativeEvent?.locationX ?? e.clientX ?? 0;

  return (
    <group
      ref={groupRef}
      onPointerDown={(e: any) => {
        dragging.current = true;
        lastX.current = getX(e);
      }}
      onPointerMove={(e: any) => {
        if (!dragging.current) return;
        const x = getX(e);
        rotationY.current += (x - lastX.current) * DRAG_SENSITIVITY;
        lastX.current = x;
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
      onPointerLeave={() => {
        dragging.current = false;
      }}
    >
      {/* Invisible drag-catcher so spinning works even when not touching the model body */}
      <mesh position={[0, TARGET_SIZE * 0.3, 0]} rotation={[0, 0, 0]}>
        <planeGeometry args={[TARGET_SIZE * 2.4, TARGET_SIZE * 1.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {children}
    </group>
  );
}

// ─── Scene contents ────────────────────────────────────────────────────────────

interface SceneProps {
  zones: DamageZone3D[];
  selectedZone: string | null;
  markedZones: string[];
  onZoneClick: (zoneId: string) => void;
}

function Scene({ zones, selectedZone, markedZones, onZoneClick }: SceneProps) {
  const markedSet = useMemo(() => new Set(markedZones), [markedZones]);

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[6, 8, 5]} intensity={1.5} />
      <directionalLight position={[-4, 3, -4]} intensity={0.5} />
      <pointLight position={[0, 4, 0]} intensity={0.4} />

      <Suspense fallback={null}>
        <RotationRig>
          <VehicleModel />
          {zones.map((zone) => (
            <Hotspot
              key={zone.id}
              zone={zone}
              isMarked={markedSet.has(zone.label)}
              isSelected={selectedZone === zone.label}
              onPress={onZoneClick}
            />
          ))}
        </RotationRig>
      </Suspense>
    </>
  );
}

// ─── Loading fallback shown while the GL context boots ────────────────────────

function ViewerLoading() {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={Colors.accent} />
      <Text style={styles.loadingText}>Loading 3D model…</Text>
    </View>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────

// `selectedZone` / `markedZones` / `onZoneClick` all key off zone *labels* —
// matching how SellCarsScreen already tracks damage records by display label.
export interface ThreeDVehicleViewerProps {
  zones: DamageZone3D[];
  selectedZone: string | null;
  markedZones: string[];
  onZoneClick: (zoneLabel: string) => void;
  height?: number;
}

export function ThreeDVehicleViewer({
  zones,
  selectedZone,
  markedZones,
  onZoneClick,
  height = 280,
}: ThreeDVehicleViewerProps) {
  const [ready, setReady] = useState(false);

  return (
    <View style={[styles.wrap, { height }]}>
      {!ready && <ViewerLoading />}
      <Canvas
        style={StyleSheet.absoluteFillObject}
        camera={{ position: [5, 3, 7], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={() => setReady(true)}
      >
        <Suspense fallback={null}>
          <Scene
            zones={zones}
            selectedZone={selectedZone}
            markedZones={markedZones}
            onZoneClick={onZoneClick}
          />
        </Suspense>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#111115',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  loadingWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    zIndex: 2,
  },
  loadingText: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
