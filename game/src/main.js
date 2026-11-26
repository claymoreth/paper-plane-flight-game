// PAPER PLANE — bootstrap.
// Renderer (ACESFilmic, sRGB, PCF shadows, pixelRatio cap 1.5), scene
// (langit 0xBFE3F2 + fog ringan), 1 DirectionalLight + HemisphereLight,
// loop setAnimationLoop + THREE.Timer, dt clamp 0.1, accumulator fixed-step
// 60 Hz (maks 5 step/frame), render interpolasi posisi pesawat.
// Debug API read-only: window.__paperplane (+ window.renderer / window.scene).

import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, seedFromLocation } from './random.js';
import { createGliderState, resetGliderState, stepGlider, headingDegrees } from './physics.js';
import { createWorld } from './world.js';
import { createPaperPlane, applyPlaneTransform } from './plane.js';
import { createRings } from './rings.js';
import { createThermals } from './thermals.js';
import { MissionManager, MISSION_DEFS } from './missions.js';
import { ChaseCamera } from './camera.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { GameAudio } from './audio.js';
import { FX } from './fx.js';
import { applyShot } from './shots.js';

const FIXED_DT = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

function main() {
  const canvas = document.getElementById('game-canvas');

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // --- Scene + kamera ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe3f2);
  scene.fog = new THREE.Fog(0xbfe3f2, 400, 1100);

  const camera = new THREE.PerspectiveCamera(
    CFG.CHASE_FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    2000,
  );
  camera.position.set(0, 60, 280);

  // --- Lights: 1 directional (key, castShadow) + hemisphere fill ---
  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.position.set(80, 120, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -150;
  sun.shadow.camera.right = 150;
  sun.shadow.camera.top = 150;
  sun.shadow.camera.bottom = -150;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 400;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfe3f2, 0xf2e6c9, 0.9);
  scene.add(hemi);

  // --- Dunia + sistem ---
  const seed = seedFromLocation(window.location.search);
  const rng = mulberry32(seed);
  const world = createWorld(scene, rng);
  const plane = createPaperPlane();
  scene.add(plane);
  const rings = createRings(scene);
  const thermals = createThermals(scene, rng);
  const missions = new MissionManager();
  const chaseCam = new ChaseCamera(camera);
  const hud = new HUD();
  const input = new Input();
  const audio = new GameAudio();
  const fx = new FX(scene);
  const state = createGliderState(CFG.SPAWN);

  // Marker titik akhir Thermal Chase: bola emas melayang di atas lingkaran.
  const endpointMarker = new THREE.Mesh(
    new THREE.SphereGeometry(3, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xffc93c, emissive: 0xcc8800, emissiveIntensity: 0.8, roughness: 0.4 }),
  );
  endpointMarker.position.set(CFG.ENDPOINT.x, CFG.ENDPOINT.y, CFG.ENDPOINT.z);
  endpointMarker.name = 'endpoint-marker';
  scene.add(endpointMarker);

  // --- Menu: pilihan misi (default Ring Run) ---
  let selectedMission = 0; // indeks MISSION_DEFS
  const menuButtons = Array.from(document.querySelectorAll('[data-mission]'));
  function markSelected() {
    for (const btn of menuButtons) {
      btn.classList.toggle('selected', Number(btn.dataset.mission) === selectedMission);
    }
  }
  function startMission(index) {
    audio.ensure();
    const def = MISSION_DEFS[index] || MISSION_DEFS[0];
    resetGliderState(state, CFG.SPAWN);
    rings.reset();
    thermals.reset();
    missions.start(def.id);
    hud.hideMenu();
    hud.hideEnd();
    chaseCam.snapTo(state);
    markSelected();
  }
  for (const btn of menuButtons) {
    btn.addEventListener('click', () => {
      selectedMission = Number(btn.dataset.mission);
      startMission(selectedMission);
    });
  }
  const restartBtn = document.getElementById('end-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      audio.ensure();
      restartCurrentMission();
    });
  }
  const menuBtn = document.getElementById('end-menu');
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      goToMenu();
    });
  }
  markSelected();

  function restartCurrentMission() {
    const def = MISSION_DEFS.find((m) => m.id === missions.missionId) || MISSION_DEFS[0];
    selectedMission = MISSION_DEFS.indexOf(def);
    resetGliderState(state, CFG.SPAWN);
    rings.reset();
    thermals.reset();
    missions.start(def.id);
    hud.hideEnd();
    hud.hideMenu();
    chaseCam.snapTo(state);
  }

  function goToMenu() {
    resetGliderState(state, CFG.SPAWN);
    rings.reset();
    thermals.reset();
    missions.toMenu();
    hud.showMenu();
    hud.hideEnd();
    chaseCam.snapTo(state);
    markSelected();
  }

  // --- Shot states (?shot=...) — auto-mulai tanpa input user ---
  const shotName = applyShot(window.location.search, {
    state,
    missions,
    rings,
    thermals,
    camera: chaseCam,
    hud,
  });

  // --- Resize ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // --- Event misi → audio / FX / shake ---
  function drainEvents() {
    while (missions.events.length > 0) {
      const ev = missions.events.shift();
      if (ev.type === 'ring') {
        audio.ring();
        const r = rings.rings[ev.index];
        if (r) fx.burst(r.center);
        chaseCam.addTrauma(CFG.SHAKE_RING);
      } else if (ev.type === 'thermal') {
        audio.thermal();
      } else if (ev.type === 'altitude') {
        audio.ring();
      } else if (ev.type === 'complete') {
        if (missions.reason === 'landing') audio.landing();
        else audio.ring();
        chaseCam.addTrauma(CFG.SHAKE_LAND);
        hud.showEnd(missions);
      } else if (ev.type === 'failed') {
        if (missions.reason === 'landed-early') audio.landing();
        else audio.crash();
        chaseCam.addTrauma(CFG.SHAKE_LAND);
        hud.showEnd(missions);
      }
    }
  }

  // --- Loop utama ---
  const timer = new THREE.Timer();
  timer.connect(document);
  let accumulator = 0;
  let elapsed = 0;

  renderer.setAnimationLoop(() => {
    timer.update();
    const frameDt = Math.min(Math.max(timer.getDelta(), 0), 0.1);
    elapsed += frameDt;

    // --- Input edge ---
    if (input.edge('mute')) {
      audio.setMuted(!audio.muted);
    }
    if (input.edge('camera')) {
      chaseCam.toggleMode();
    }
    if (missions.status === 'menu') {
      const digit = input.digit();
      if (digit >= 1 && digit <= 4) {
        selectedMission = digit - 1;
        markSelected();
      }
      if (input.edge('start')) {
        startMission(selectedMission);
      }
      // Abaikan input penerbangan lain saat menu.
      input.edge('pause');
      input.edge('restart');
      input.edge('menu');
    } else if (missions.status === 'flying') {
      if (input.edge('pause')) {
        missions.pause();
        hud.showPause(true);
      }
      if (input.edge('restart')) {
        restartCurrentMission();
      }
      if (input.edge('menu')) {
        goToMenu();
      }
    } else if (missions.status === 'paused') {
      if (input.edge('pause')) {
        missions.resume();
        hud.showPause(false);
      }
      if (input.edge('restart')) {
        hud.showPause(false);
        restartCurrentMission();
      }
      if (input.edge('menu')) {
        hud.showPause(false);
        goToMenu();
      }
    } else if (missions.status === 'complete' || missions.status === 'failed') {
      if (input.edge('restart')) {
        restartCurrentMission();
      }
      if (input.edge('menu') || input.edge('start')) {
        goToMenu();
      }
    }

    // --- Fixed-step simulation (accumulator, maks 5 step/frame) ---
    if (missions.status === 'flying') {
      accumulator += frameDt;
      let steps = 0;
      while (accumulator >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        const flight = input.flightInput();
        stepGlider(state, flight, FIXED_DT, (pos) => thermals.isInside(pos) !== null);
        missions.update(FIXED_DT, { state, rings, thermals, world });
        accumulator -= FIXED_DT;
        steps++;
        if (missions.status !== 'flying') break;
      }
      if (steps >= MAX_STEPS_PER_FRAME) accumulator = 0; // buang sisa: slow-motion lebih baik dari spiral
    } else {
      accumulator = 0;
    }
    const alpha = missions.status === 'flying' ? accumulator / FIXED_DT : 1;

    // --- Visual per frame (bukan simulasi) ---
    applyPlaneTransform(plane, state, alpha);
    chaseCam.update(frameDt, state, alpha);
    world.update(frameDt, elapsed);
    thermals.update(frameDt);
    fx.update(frameDt);
    rings.faceLabels(camera);
    endpointMarker.rotation.y += frameDt * 0.8;
    endpointMarker.position.y = CFG.ENDPOINT.y + Math.sin(elapsed * 1.2) * 1.5;
    endpointMarker.visible = missions.missionId === 'thermal-chase' && missions.altitudeReached;
    if (state.inThermal) fx.trail(state.pos);

    drainEvents();
    audio.setWind(missions.status === 'flying' ? state.speed : 0);
    hud.update(state, missions, chaseCam.mode);

    renderer.render(scene, camera);
  });

  // --- Debug API read-only untuk smoke test / playtest ---
  const api = {};
  Object.defineProperties(api, {
    pos: { get: () => ({ x: state.pos.x, y: state.pos.y, z: state.pos.z }) },
    speed: { get: () => state.speed },
    headingDeg: { get: () => headingDegrees(state) },
    altitude: { get: () => state.pos.y },
    mission: { get: () => missions.missionId },
    ringsPassed: { get: () => missions.ringsPassed },
    ringsTotal: { get: () => missions.ringsTotal },
    status: { get: () => missions.status },
    inThermal: { get: () => state.inThermal },
    timeLeft: { get: () => missions.timeLeft },
    score: { get: () => missions.score },
    trauma: { get: () => chaseCam.trauma },
    shot: { get: () => shotName },
    seed: { get: () => seed },
  });
  window.__paperplane = Object.freeze(api);
  window.renderer = renderer;
  window.scene = scene;
}

main();
