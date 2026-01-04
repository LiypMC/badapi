"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export default function HeroCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.z = 6;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    const geometry = new THREE.IcosahedronGeometry(1.7, 1);
    const material = new THREE.MeshStandardMaterial({
      color: "#1f2a38",
      metalness: 0.7,
      roughness: 0.2,
      emissive: "#0a1a1f",
      emissiveIntensity: 0.6
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const ringGeometry = new THREE.RingGeometry(2.2, 2.4, 64);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: "#79ffe1", transparent: true, opacity: 0.35 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2.5;
    scene.add(ring);

    const light = new THREE.PointLight("#7aa2ff", 2, 15);
    light.position.set(5, 4, 6);
    scene.add(light);

    const ambient = new THREE.AmbientLight("#99b4ff", 0.6);
    scene.add(ambient);

    let frameId = 0;
    const animate = () => {
      mesh.rotation.x += 0.004;
      mesh.rotation.y += 0.006;
      ring.rotation.z -= 0.002;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    const handleResize = () => {
      if (!mount) return;
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      material.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      renderer.dispose();
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div className="hero-canvas glass" ref={mountRef} />;
}
