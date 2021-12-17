import * as THREE from 'three';
// import Simplex from './simplex-noise.js';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useScene, useInternals, useLocalPlayer, useActivate, useUse, useWear, useCleanup} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();

export default () => {
  const app = useApp();
  const scene = useScene();
  const {sceneLowPriority} = useInternals();

  const {components} = app;

  class TrailMesh extends THREE.Mesh {
    constructor(a, b) {
      const numPositions = 256;

      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(6*3*numPositions);
      const positionAttribute = new THREE.BufferAttribute(positions, 3);
      geometry.setAttribute('position', positionAttribute);
      const ts = new Float32Array(positions.length/3);
      const tAttribute = new THREE.BufferAttribute(ts, 1);
      geometry.setAttribute('t', tAttribute);
      geometry.setDrawRange(0, 0);
      
      const trailVsh = `\
        ${THREE.ShaderChunk.common}
        // #define PI 3.1415926535897932384626433832795

        uniform float uTime;
        attribute float t;
        varying float vT;

        /* mat4 rotationMatrix(vec3 axis, float angle)
        {
            axis = normalize(axis);
            float s = sin(angle);
            float c = cos(angle);
            float oc = 1.0 - c;
            
            return mat4(oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,  0.0,
                        oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,  0.0,
                        oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c,           0.0,
                        0.0,                                0.0,                                0.0,                                1.0);
        }

        varying float vDepth; */

        ${THREE.ShaderChunk.logdepthbuf_pars_vertex}

        void main() {
          float f = 1. - pow((uTime - vT)/100., 0.1);
          vec3 p = (f >= -1.) ? position : vec3(0.);
          // vec3 p = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.);
          vT = t;
          ${THREE.ShaderChunk.logdepthbuf_vertex}
        }
      `;
      const trailFsh = `\
        // #define PI 3.1415926535897932384626433832795
        
        // uniform sampler2D uTex;
        // uniform vec3 uColor;
        uniform float uTime;
        varying float vT;
        
        // vec3 grey = vec3(0.5);
        vec3 grey = vec3(0.7);
        ${THREE.ShaderChunk.logdepthbuf_pars_fragment}

        void main() {
          float f = 1. - pow((uTime - vT)/100., 0.1);
          if (f >= 0.) {
            gl_FragColor = vec4(grey, f);
          } else {
            discard;
          }
          ${THREE.ShaderChunk.logdepthbuf_fragment}
        }
      `;
      const material = new THREE.ShaderMaterial({
        uniforms: {
          /* uColor: {
            type: 'c',
            value: new THREE.Color(0xef5350),
            needsUpdate: true,
          }, */
          uTime: {
            type: 'f',
            value: 0,
            needsUpdate: true,
          },
        },
        vertexShader: trailVsh,
        fragmentShader: trailFsh,
        side: THREE.DoubleSide,
        // depthWrite: false,
        transparent: true,
      });
      
      super(geometry, material);
      this.frustumCulled = false;

      this.a = a;
      this.b = b;
      this.lastAWorld = new THREE.Vector3(NaN, NaN, NaN);
      this.lastBWorld = new THREE.Vector3(NaN, NaN, NaN);
      this.positionIndex = 0;
      this.tIndex = 0;
      this.lastNow = -Infinity;
      this.lastEnabled = false;
      this.lastTriggerStartTime = -Infinity;
    }
    update(enabled, matrixWorld) {
      let now = performance.now();

      if (enabled && !this.lastEnabled) {
        this.lastAWorld.set(NaN, NaN, NaN);
        this.lastBWorld.set(NaN, NaN, NaN);
        this.positionIndex = 0;
        this.tIndex = 0;
        this.lastNow = -Infinity;
        this.lastTriggerStartTime = now;
      }
      now -= this.lastTriggerStartTime;
      // console.log('got now', now);

      if (enabled && !isNaN(this.lastAWorld.x) && !isNaN(this.lastBWorld.x)) {
        const positions = this.geometry.attributes.position.array;
        const ts = this.geometry.attributes.t.array;

        {
          const startIndex = this.positionIndex;

          this.lastAWorld
            .toArray(positions, this.positionIndex);
          this.positionIndex += 3;

          this.lastBWorld
            .toArray(positions, this.positionIndex);
          this.positionIndex += 3;

          localVector.copy(this.b)
            .applyMatrix4(matrixWorld)
            .toArray(positions, this.positionIndex);
          this.positionIndex += 3;

          this.lastAWorld
            .toArray(positions, this.positionIndex);
          this.positionIndex += 3;

          localVector.copy(this.b)
            .applyMatrix4(matrixWorld)
            .toArray(positions, this.positionIndex);
          this.positionIndex += 3;

          localVector.copy(this.a)
            .applyMatrix4(matrixWorld)
            .toArray(positions, this.positionIndex);
          this.positionIndex += 3;

          this.geometry.attributes.position.updateRange = {
            offset: startIndex,
            count: (this.positionIndex - startIndex),
          };
          this.geometry.attributes.position.needsUpdate = true;

          this.positionIndex = this.positionIndex % this.geometry.attributes.position.array.length;
        }
        {
          const startIndex = this.tIndex;

          ts[this.tIndex++] = this.lastNow;
          ts[this.tIndex++] = this.lastNow;
          ts[this.tIndex++] = now;
          ts[this.tIndex++] = this.lastNow;
          ts[this.tIndex++] = now;
          ts[this.tIndex++] = now;

          this.geometry.attributes.t.updateRange = {
            offset: startIndex,
            count: (this.tIndex - startIndex),
          };
          this.geometry.attributes.t.needsUpdate = true;

          this.tIndex = this.tIndex % this.geometry.attributes.t.array.length;
        }
      } 

      this.lastAWorld.copy(this.a)
        .applyMatrix4(matrixWorld);
      this.lastBWorld.copy(this.b)
        .applyMatrix4(matrixWorld);
      this.lastNow = now;
      this.lastEnabled = enabled;

      this.geometry.setDrawRange(0, this.positionIndex/3);

      this.material.uniforms.uTime.value = now;
      this.material.uniforms.uTime.needsUpdate = true;
    }
  }
  let trailMesh = null;
  const useComponent = components.find(component => component.key === 'use');
  const trail = useComponent?.value.trail;
  // console.log('got trail', components, useComponent, trail);
  if (Array.isArray(trail)) {
    const a = new THREE.Vector3().fromArray(trail[0]);
    const b = new THREE.Vector3().fromArray(trail[1]);
    trailMesh = new TrailMesh(a, b);
    sceneLowPriority.add(trailMesh);
    // window.trailMesh = trailMesh;
  }

  let subApp = null;
  (async () => {
    const u2 = baseUrl + 'megasword_v4_texta.glb';
    const m = await metaversefile.import(u2);

    subApp = metaversefile.createApp({
      name: u2,
    });
    subApp.position.copy(app.position);
    subApp.quaternion.copy(app.quaternion);
    subApp.scale.copy(app.scale);
    subApp.updateMatrixWorld();
    subApp.contentId = u2;
    subApp.instanceId = app.instanceId;

    for (const {key, value} of components) {
      subApp.setComponent(key, value);
    }
    await subApp.addModule(m);
    scene.add(subApp);
  })();

  useActivate(() => {
    const localPlayer = useLocalPlayer();
    localPlayer.wear(app);
  });

  // let wearing = false;
  useWear(e => {
    const {wear} = e;
    if (subApp) {
      subApp.dispatchEvent({
        type: 'wearupdate',
        wear,
      });
    }
    // wearing = !!wear;
  });

  let using = false;
  useUse(e => {
    using = e.use;
  });

  useFrame(() => {
    if (trailMesh && subApp) {
      trailMesh.update(using, subApp.matrixWorld);
    }
  });

  useCleanup(() => {
    trailMesh && sceneLowPriority.remove(trailMesh);
  });

  app.getPhysicsObjects = () => {
    const result = subApp ? subApp.getPhysicsObjects() : [];
    return result;
  };

  return app;
};