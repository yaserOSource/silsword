import * as THREE from 'three';
// import Simplex from './simplex-noise.js';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useScene, useInternals, useLocalPlayer, useActivate, useUse, useWear, usePhysics, getAppByPhysicsId, useCleanup} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');

const localVector = new THREE.Vector3();
const localVector2 = new THREE.Vector3();
const localVector3 = new THREE.Vector3();
const localQuaternion = new THREE.Quaternion();

export default () => {
  const app = useApp();
  const scene = useScene();
  const {sceneLowPriority} = useInternals();
  const physics = usePhysics();

  const {components} = app;

  const swordLength = 1.6;
  const maxNumDecals = 128;
  const normalScale = 0.03;
  // const decalGeometry = new THREE.PlaneBufferGeometry(0.5, 0.5, 8, 8).toNonIndexed();
  const numSegments = 128;
  const planeGeometry = new THREE.PlaneBufferGeometry(1, 1, 1, numSegments)
    // .applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(0, 0, 1), Math.PI*0.5))
    .applyMatrix4(new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), -Math.PI*0.5))
    .toNonIndexed();
  // const size = 0.04;
  // const decalGeometry = new THREE.BoxBufferGeometry(size, size, size).toNonIndexed();
  const texture = new THREE.TextureLoader().load(baseUrl + 'chevron2.svg');
  const decalMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xFF0000,
    map: texture,
    side: THREE.DoubleSide,
    // transparent: true,
  });
  // const m = new THREE.Mesh(planeGeometry, decalMaterial);
  // scene.add(m);
  const _makeDecalMesh = () => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(planeGeometry.attributes.position.array.length * maxNumDecals);
    const positionsAttribute = new THREE.BufferAttribute(positions, 3);
    geometry.setAttribute('position', positionsAttribute);
    const normals = new Float32Array(planeGeometry.attributes.normal.array.length * maxNumDecals);
    const normalsAttribute = new THREE.BufferAttribute(normals, 3);
    geometry.setAttribute('normal', normalsAttribute);
    const uvs = new Float32Array(planeGeometry.attributes.uv.array.length * maxNumDecals);
    const uvsAttribute = new THREE.BufferAttribute(uvs, 2);
    geometry.setAttribute('uv', uvsAttribute);
    // const indices = new Uint16Array(planeGeometry.index.array.length * maxNumDecals);
    // const indicesAttribute = new THREE.BufferAttribute(indices, 1);
    // geometry.setIndex(indicesAttribute);

    const decalMesh = new THREE.Mesh(geometry, decalMaterial);
    decalMesh.name = 'DecalMesh';
    decalMesh.frustumCulled = false;
    decalMesh.offset = 0;
    let lastPoint = null;
    decalMesh.update = (using, matrixWorld) => {
      if (!using) {
        lastPoint = null;
        return;
      }

      const _getNextPoint = () => {
        matrixWorld.decompose(localVector, localQuaternion, localVector2);
        localQuaternion.multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI*0.5)
        );

        const result = physics.raycast(localVector, localQuaternion);
        if (result) {
          const hitPoint = new THREE.Vector3().fromArray(result.point);
          if (hitPoint.distanceTo(localVector) <= swordLength) {
            const normal = new THREE.Vector3().fromArray(result.normal);

            const normalScaled = normal.clone().multiplyScalar(normalScale);
            const centerPoint = hitPoint.clone().add(normalScaled);
    
            const normalDownQuaternion = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 0, 1),
              normal
            );
    
            const forwardPoint = centerPoint.clone()
              .add(
                new THREE.Vector3(-0.1, 0, 0)
                  .applyQuaternion(localQuaternion)
              );
            const forwardResult = physics.raycast(
              forwardPoint,
              normalDownQuaternion
            );
            if (forwardResult) {
              const forwardPointVec = new THREE.Vector3().fromArray(forwardResult.point);
              if (forwardPointVec.distanceTo(localVector) <= swordLength) {
                forwardPoint.copy(forwardPointVec);
              }
            }
    
            const backwardPoint = centerPoint.clone()
              .add(
                new THREE.Vector3(0.1, 0, 0)
                  .applyQuaternion(localQuaternion)
              );
            const backwardResult = physics.raycast(
              backwardPoint,
              normalDownQuaternion
            );
            if (backwardResult) {
              const backwardPointVec = new THREE.Vector3().fromArray(backwardResult.point);
              if (backwardPointVec.distanceTo(localVector) <= swordLength) {
                backwardPoint.copy(backwardPointVec);
              }
            }

            const rotationMatrix = new THREE.Matrix4().lookAt(
              centerPoint,
              centerPoint.clone()
                .add(
                  normal.clone()
                    .cross(new THREE.Vector3(0, 1, 0).applyQuaternion(localQuaternion))
                ),
              normal
            );
    
            const width = forwardPoint.distanceTo(backwardPoint);
            const thickness = 0.05;

            return {
              // hitPoint,
              centerPoint,
              // quaternion: localQuaternion.clone(),
              rotationMatrix,
              normal,
              normalScaled,
              normalDownQuaternion,
              width,
              thickness,
              forwardLeftPoint: null,
              forwardRightPoint: null,
            };
          } else {
            return null;
          }
        } else {
          return null;
        }
      };
      const _drawPoints = (lastPoint, nextPoint) => {
        if (nextPoint) {
          const {centerPoint, rotationMatrix, normal, normalScaled, normalDownQuaternion, width, thickness} = nextPoint;

          // console.log('log', width, thickness);

          const localDecalGeometry = planeGeometry.clone()
            .applyMatrix4(new THREE.Matrix4().makeScale(thickness, 1, width));
          
          if (!lastPoint) {
            localDecalGeometry
              .applyMatrix4(rotationMatrix);
          } else {
            localDecalGeometry
              .applyMatrix4(
                new THREE.Matrix4().lookAt(
                  lastPoint.centerPoint,
                  centerPoint,
                  normal
                )
              )
          }
          localDecalGeometry
            .applyMatrix4(new THREE.Matrix4().makeTranslation(centerPoint.x, centerPoint.y, centerPoint.z));

          // if there was a previous point copy the last point's forward points to the next point's backward points
          if (lastPoint) {
            for (let i = 0; i < localDecalGeometry.attributes.position.count; i++) {
              localVector.fromArray(planeGeometry.attributes.position.array, i*3);
              if (localVector.z >= 0.5) { // if this is a backward point
                const isLeft = localVector.x < 0;
                (isLeft ? lastPoint.forwardLeftPoint : lastPoint.forwardRightPoint)
                // localVector.fromArray(decalGeometry.attributes.position.array, lastOffset + srcIndex * 3)
                  .toArray(localDecalGeometry.attributes.position.array, i*3);
              }
            }
          }

          // make the local decal geometry conform to the object mesh by raycasting from the decal mesh points down the normal
          for (let i = 0; i < localDecalGeometry.attributes.position.count; i++) {
            localVector.fromArray(localDecalGeometry.attributes.position.array, i*3);
            const result = physics.raycast(localVector, normalDownQuaternion);
            if (result) {
              localVector3.fromArray(result.point);
              if (localVector.distanceTo(localVector3) < swordLength) {
                localVector3
                  .add(normalScaled)
                  .toArray(localDecalGeometry.attributes.position.array, i*3);
              }
            }
          }


          nextPoint.forwardLeftPoint = new THREE.Vector3().fromArray(localDecalGeometry.attributes.position.array, 0*3);
          nextPoint.forwardRightPoint = new THREE.Vector3().fromArray(localDecalGeometry.attributes.position.array, 2*3);

          decalMesh.mergeGeometry(localDecalGeometry);
        }
      };
      const nextPoint = _getNextPoint();
      _drawPoints(lastPoint, nextPoint);
      lastPoint = nextPoint;
    };
    decalMesh.mergeGeometry = localDecalGeometry => {
      const offset = decalMesh.offset;
      // console.log('offset', decalMesh.offset);
      for (let i = 0; i < localDecalGeometry.attributes.position.count; i++) {
        decalMesh.geometry.attributes.position.setXYZ( i + offset, localDecalGeometry.attributes.position.getX(i), localDecalGeometry.attributes.position.getY(i), localDecalGeometry.attributes.position.getZ(i) );
        decalMesh.geometry.attributes.uv.setXY( i + offset, localDecalGeometry.attributes.uv.getX(i), localDecalGeometry.attributes.uv.getY(i) );
        decalMesh.geometry.attributes.normal.setXYZ( i + offset, localDecalGeometry.attributes.normal.getX(i), localDecalGeometry.attributes.normal.getY(i), localDecalGeometry.attributes.normal.getZ(i) );
        // decalMesh.geometry.index.setX( i + offset, localDecalGeometry.index.getX(i) );
      }
      // flag geometry attributes for update
      decalMesh.geometry.attributes.position.updateRange = {
        offset: offset*3,
        count: localDecalGeometry.attributes.position.array.length,
      };
      decalMesh.geometry.attributes.position.needsUpdate = true;
      decalMesh.geometry.attributes.uv.updateRange = {
        offset: offset*2,
        count: localDecalGeometry.attributes.uv.array.length,
      };
      decalMesh.geometry.attributes.uv.needsUpdate = true;
      decalMesh.geometry.attributes.normal.updateRange = {
        offset: offset*3,
        count: localDecalGeometry.attributes.normal.array.length,
      };
      decalMesh.geometry.attributes.normal.needsUpdate = true;
      // decalMesh.geometry.index.updateRange = {
      //   offset,
      //   count: localDecalGeometry.index.count,
      // };
      //decalMesh.geometry.index.needsUpdate = true;
      // update geometry attribute offset
      decalMesh.offset += localDecalGeometry.attributes.position.count;
      decalMesh.offset = decalMesh.offset % decalMesh.geometry.attributes.position.count;
    };

    return decalMesh;
  };
  const decalMesh = _makeDecalMesh();
  scene.add(decalMesh);
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
    if (decalMesh && subApp) {
      decalMesh.update(using, subApp.matrixWorld);
    }
  });

  useCleanup(() => {
    trailMesh && sceneLowPriority.remove(trailMesh);
    decalMesh && scene.remove(decalMesh);
  });

  app.getPhysicsObjects = () => {
    const result = subApp ? subApp.getPhysicsObjects() : [];
    return result;
  };

  return app;
};