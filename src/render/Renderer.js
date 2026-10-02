import * as THREE from 'three';
import { CONFIG } from '../config.js';

function lerpAngle(a, b, k) {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * k;
}

export class Renderer {
  constructor(host) {
    const gl = (this.gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }));
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.VIEW.maxPixelRatio));
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.1;
    host.appendChild(gl.domElement);

    const scene = (this.scene = new THREE.Scene());
    const bg = new THREE.Color(0x140b05);
    scene.background = bg;
    scene.fog = new THREE.Fog(bg, CONFIG.VIEW.fogNear, CONFIG.VIEW.fogFar);

    const C = CONFIG.CAMERA;
    // User-adjustable view parameters (see setView).
    this.view = { tilt: C.tilt, distance: C.distance, fov: C.fov, fpFov: C.fpFov, fog: 1 };

    this.persp = new THREE.PerspectiveCamera(C.fov, 1, 0.1, 200);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.fpCam = new THREE.PerspectiveCamera(C.fpFov, 1, 0.05, 200);
    this.camera = this.persp;
    this.mode = 'persp';
    this.fpYaw = 0;
    this._fpSnap = true;

    scene.add(new THREE.HemisphereLight(0xffd9a0, 0x1a0e06, 0.55));
    const moon = new THREE.DirectionalLight(0x8a96b8, 0.35);
    moon.position.set(-5, 10, 3);
    scene.add(moon);

    this.torch = new THREE.PointLight(0xffa850, 16, 20, 1);
    scene.add(this.torch);
    this.flashLight = new THREE.PointLight(0xffc070, 0, 16, 1.2);
    scene.add(this.flashLight);
    this.fireLight = new THREE.PointLight(0xff6a20, 0, 10, 1.2);
    scene.add(this.fireLight);

    this.target = new THREE.Vector3();
    this.shakeAmt = 0;
    this.flashT = 0;
    this.aspect = 1;
    this._v = new THREE.Vector3();

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this._applyFog();
  }

  // 'persp' | 'ortho' | 'fps'
  setMode(mode) {
    const m = mode === 'ortho' || mode === 'fps' ? mode : 'persp';
    if (m === 'fps' && this.mode !== 'fps') this._fpSnap = true;
    this.mode = m;
    this.camera = m === 'ortho' ? this.ortho : m === 'fps' ? this.fpCam : this.persp;
    this._applyFog();
  }

  setView(v) {
    for (const [k, val] of Object.entries(v)) if (Number.isFinite(val)) this.view[k] = val;
    this.persp.fov = this.view.fov;
    this.fpCam.fov = this.view.fpFov;
    this.resize();
    this._applyFog();
  }

  _applyFog() {
    const V = CONFIG.VIEW, s = this.view.fog, fog = this.scene.fog;
    if (this.mode === 'fps') {
      fog.near = V.fpFogNear * s;
      fog.far = V.fpFogFar * s;
    } else {
      const k = this.view.distance / CONFIG.CAMERA.distance;
      fog.near = V.fogNear * k * s;
      fog.far = V.fogFar * k * s;
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.gl.setSize(w, h);
    this.aspect = w / h;
    for (const cam of [this.persp, this.fpCam]) {
      cam.aspect = this.aspect;
      cam.updateProjectionMatrix();
    }
    const C = CONFIG.CAMERA;
    const H = C.orthoHeight * (this.view.distance / C.distance) * (this.aspect < 1 ? 1.35 : 1);
    this.ortho.left = (-H * this.aspect) / 2;
    this.ortho.right = (H * this.aspect) / 2;
    this.ortho.top = H / 2;
    this.ortho.bottom = -H / 2;
    this.ortho.updateProjectionMatrix();
  }

  _shake(dt) {
    let sx = 0, sy = 0;
    if (this.shakeAmt > 0.001) {
      sx = (Math.random() - 0.5) * this.shakeAmt;
      sy = (Math.random() - 0.5) * this.shakeAmt;
      this.shakeAmt *= Math.exp(-dt * 8);
    }
    return [sx, sy];
  }

  follow(x, z, dirX, dirZ, dt, snap = false) {
    const C = CONFIG.CAMERA;
    if (snap) this._fpSnap = true;
    const tx = x + dirX * C.lookAhead, tz = z + dirZ * C.lookAhead;
    const k = snap ? 1 : 1 - Math.exp(-dt * C.damping);
    this.target.x += (tx - this.target.x) * k;
    this.target.z += (tz - this.target.z) * k;
    const tilt = (this.view.tilt * Math.PI) / 180;
    const D = this.view.distance * (this.aspect < 1 ? 1.35 : 1);
    const [sx, sy] = this._shake(dt);
    const cam = this.camera === this.fpCam ? this.persp : this.camera;
    cam.position.set(this.target.x + sx, D * Math.cos(tilt) + sy, this.target.z + D * Math.sin(tilt));
    cam.lookAt(this.target.x + sx * 0.5, 0, this.target.z);
  }

  // First-person camera at the player's eye, looking along `yaw` (radians in x-z).
  followFirstPerson(x, z, yaw, dt, bob = 0) {
    const C = CONFIG.CAMERA;
    const k = this._fpSnap ? 1 : 1 - Math.exp(-dt * C.fpTurnDamping);
    this._fpSnap = false;
    this.fpYaw = lerpAngle(this.fpYaw, yaw, k);
    const cx = Math.cos(this.fpYaw), cz = Math.sin(this.fpYaw);
    const [sx, sy] = this._shake(dt);
    const eye = C.eyeHeight + bob;
    const px = x - cx * C.fpBack, pz = z - cz * C.fpBack;
    this.fpCam.position.set(px + sx * 0.2, eye + sy * 0.2, pz);
    this.fpCam.lookAt(px + cx * 4, eye - C.fpPitch * 4, pz + cz * 4);
    this.target.set(x, 0, z);
  }

  setTorch(x, z, t) {
    this.torch.position.set(x, 2.6, z);
    this.torch.intensity = 16 * (0.92 + 0.05 * Math.sin(t * 13) + 0.03 * Math.sin(t * 29));
  }

  addShake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }

  flash(x, z, color = 0xffb060) {
    this.flashLight.position.set(x, 2, z);
    this.flashLight.color.set(color);
    this.flashT = 1;
  }

  // Screen position of a world point, or null if it is behind the camera.
  project(x, y, z) {
    const v = this._v.set(x, y, z).project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  }

  render(dt) {
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt * 3.5);
    this.flashLight.intensity = 70 * this.flashT * this.flashT;
    this.gl.render(this.scene, this.camera);
  }
}