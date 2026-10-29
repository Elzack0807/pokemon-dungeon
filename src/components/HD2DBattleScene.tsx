import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { PokemonInstance } from '../types/pokemon';
import { POKEMON_SPECIES } from '../data/pokemonData';
import {
  isSoftwareGl,
  createStoneFloorTexture,
  createStoneWallTexture,
  createBattlePedestalTexture,
  createContactShadowTexture,
  createTorchFlameTexture,
} from '../utils/hd2dTextures';

export type CameraPreset = 'isometric' | 'action' | 'tactical';

interface HD2DBattleSceneProps {
  playerPokemon: PokemonInstance;
  opponentPokemon: PokemonInstance;
  shakeTarget: 'player' | 'opponent' | null;
  isCatching?: boolean;
  catchShakes?: number;
  cameraPreset?: CameraPreset;
  onCycleCamera?: () => void;
}

// Module-level pre-allocated vectors to prevent GC churn during render loop
const _vec3 = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetCamLook = new THREE.Vector3();

export const HD2DBattleScene: React.FC<HD2DBattleSceneProps> = ({
  playerPokemon,
  opponentPokemon,
  shakeTarget,
  isCatching = false,
  catchShakes = 0,
  cameraPreset = 'isometric',
  onCycleCamera,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // References to keep updated across React renders without restarting Three.js scene
  const sceneRefs = useRef<{
    playerMesh?: THREE.Mesh;
    opponentMesh?: THREE.Mesh;
    pokeballMesh?: THREE.Group;
    torchLights: THREE.PointLight[];
    playerMat?: THREE.MeshStandardMaterial;
    opponentMat?: THREE.MeshStandardMaterial;
    pedestalMatPlayer?: THREE.MeshStandardMaterial;
    pedestalMatOpponent?: THREE.MeshStandardMaterial;
    particles?: THREE.Points;
    camera?: THREE.PerspectiveCamera;
  }>({
    torchLights: [],
  });

  const textureLoaderRef = useRef<THREE.TextureLoader>(new THREE.TextureLoader());

  // Helper to get PokeAPI sprite URLs (high-res transparent PNGs)
  const getPokemonSpriteUrl = (pkm: PokemonInstance, isBack: boolean = false) => {
    const dexNo = pkm.pokedexNo || POKEMON_SPECIES[pkm.speciesId]?.pokedexNo || 25;
    if (isBack) {
      return pkm.isShiny
        ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/shiny/${dexNo}.png`
        : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/back/${dexNo}.png`;
    }
    return pkm.isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${dexNo}.png`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexNo}.png`;
  };

  // Setup Three.js scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Renderer setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c0f18);
    scene.fog = new THREE.FogExp2(0x0c0f18, 0.045);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(-2, 5.2, 8.5);
    camera.lookAt(0, 1.2, 0);
    sceneRefs.current.camera = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 2. Mandatory RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Atmospheric Lights
    const hemiLight = new THREE.HemisphereLight(0x2d3a58, 0x0f131d, 1.2);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffecd0, 2.2);
    keyLight.position.set(5, 12, 6);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 30;
      keyLight.shadow.camera.left = -8;
      keyLight.shadow.camera.right = 8;
      keyLight.shadow.camera.top = 8;
      keyLight.shadow.camera.bottom = -8;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    // Rim blue dungeon light
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.0);
    rimLight.position.set(-6, 8, -6);
    scene.add(rimLight);

    // 4. Diorama 3D Architecture: Stone Floor
    const floorTex = createStoneFloorTexture();
    floorTex.repeat.set(6, 6);
    floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const floorGeo = new THREE.PlaneGeometry(24, 24, 8, 8);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.85,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMesh);

    // Back & Side Stone Dungeon Walls
    const wallTex = createStoneWallTexture();
    wallTex.repeat.set(8, 2);
    wallTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      roughness: 0.9,
      metalness: 0.05,
    });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(24, 6, 1), wallMat);
    backWall.position.set(0, 3, -7);
    backWall.receiveShadow = !isSoftwareGl;
    scene.add(backWall);

    // 5. Procedural 3D Stone Pillars with Torches (Group composition per skills guidelines)
    const flameTex = createTorchFlameTexture();
    const torchPositions = [
      [-6, 0, -5],
      [6, 0, -5],
      [-7, 0, 1],
      [7, 0, 1],
    ];

    const torchLights: THREE.PointLight[] = [];

    torchPositions.forEach(([tx, ty, tz]) => {
      const pillarGroup = new THREE.Group();
      pillarGroup.position.set(tx, ty, tz);

      // Pillar base
      const baseGeo = new THREE.BoxGeometry(1.2, 0.4, 1.2);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x1f2735, roughness: 0.9 });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.2;
      baseMesh.castShadow = !isSoftwareGl;
      pillarGroup.add(baseMesh);

      // Shaft
      const shaftGeo = new THREE.CylinderGeometry(0.4, 0.45, 3.2, 8);
      const shaftMesh = new THREE.Mesh(shaftGeo, baseMat);
      shaftMesh.position.y = 1.9;
      shaftMesh.castShadow = !isSoftwareGl;
      pillarGroup.add(shaftMesh);

      // Capital / Bowl
      const bowlGeo = new THREE.CylinderGeometry(0.65, 0.35, 0.4, 8);
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x111622, metalness: 0.8, roughness: 0.4 });
      const bowlMesh = new THREE.Mesh(bowlGeo, ironMat);
      bowlMesh.position.y = 3.6;
      pillarGroup.add(bowlMesh);

      // Torch flame billboard
      const flameMat = new THREE.MeshBasicMaterial({
        map: flameTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const flameMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.4), flameMat);
      flameMesh.position.y = 4.3;
      pillarGroup.add(flameMesh);

      // Real Flickering Torch Point Light
      const pLight = new THREE.PointLight(0xff8c2a, 3.5, 9, 1.8);
      pLight.position.set(0, 4.2, 0);
      pLight.castShadow = !isSoftwareGl;
      if (pLight.castShadow) {
        pLight.shadow.bias = -0.001;
      }
      pillarGroup.add(pLight);
      torchLights.push(pLight);

      scene.add(pillarGroup);
    });

    sceneRefs.current.torchLights = torchLights;

    // 6. 3D Battle Pedestals (Raised Rune Platforms)
    const contactShadowTex = createContactShadowTexture();
    const pedestalGeo = new THREE.CylinderGeometry(1.8, 1.9, 0.25, 32);

    // Player Platform (Bottom-Left in isometric view: x = -2.4, z = 2.0)
    const playerPedTex = createBattlePedestalTexture('#38bdf8');
    const playerPedMat = new THREE.MeshStandardMaterial({
      map: playerPedTex,
      roughness: 0.7,
      metalness: 0.2,
    });
    sceneRefs.current.pedestalMatPlayer = playerPedMat;

    const playerPedestal = new THREE.Mesh(pedestalGeo, playerPedMat);
    playerPedestal.position.set(-2.4, 0.12, 1.8);
    playerPedestal.receiveShadow = !isSoftwareGl;
    scene.add(playerPedestal);

    // Opponent Platform (Top-Right: x = 2.4, z = -1.8)
    const oppPedTex = createBattlePedestalTexture('#f43f5e');
    const oppPedMat = new THREE.MeshStandardMaterial({
      map: oppPedTex,
      roughness: 0.7,
      metalness: 0.2,
    });
    sceneRefs.current.pedestalMatOpponent = oppPedMat;

    const oppPedestal = new THREE.Mesh(pedestalGeo, oppPedMat);
    oppPedestal.position.set(2.4, 0.12, -1.8);
    oppPedestal.receiveShadow = !isSoftwareGl;
    scene.add(oppPedestal);

    // Ground Contact Shadow Discs
    const shadowGeo = new THREE.PlaneGeometry(3.6, 3.6);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });

    const pShadow = new THREE.Mesh(shadowGeo, shadowMat);
    pShadow.rotation.x = -Math.PI / 2;
    pShadow.position.set(-2.4, 0.26, 1.8);
    scene.add(pShadow);

    const oShadow = new THREE.Mesh(shadowGeo, shadowMat);
    oShadow.rotation.x = -Math.PI / 2;
    oShadow.position.set(2.4, 0.26, -1.8);
    scene.add(oShadow);

    // 7. Billboard Pixel Sprites for Pokémon
    // Player Sprite Mesh
    const playerSpriteGeo = new THREE.PlaneGeometry(2.4, 2.4);
    const playerMat = new THREE.MeshStandardMaterial({
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.8,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    sceneRefs.current.playerMat = playerMat;

    const playerMesh = new THREE.Mesh(playerSpriteGeo, playerMat);
    playerMesh.position.set(-2.4, 1.45, 1.8);
    playerMesh.castShadow = !isSoftwareGl;
    scene.add(playerMesh);
    sceneRefs.current.playerMesh = playerMesh;

    // Opponent Sprite Mesh
    const oppSpriteGeo = new THREE.PlaneGeometry(2.4, 2.4);
    const oppMat = new THREE.MeshStandardMaterial({
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.8,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    sceneRefs.current.opponentMat = oppMat;

    const oppMesh = new THREE.Mesh(oppSpriteGeo, oppMat);
    oppMesh.position.set(2.4, 1.45, -1.8);
    oppMesh.castShadow = !isSoftwareGl;
    scene.add(oppMesh);
    sceneRefs.current.opponentMesh = oppMesh;

    // 8. 3D Pokéball Mesh for capture animation
    const ballGroup = new THREE.Group();
    ballGroup.position.set(2.4, 1.0, -1.8);
    ballGroup.visible = false;

    const ballGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const ballMatTop = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.1 });
    const ballTop = new THREE.Mesh(ballGeo, ballMatTop);
    ballGroup.add(ballTop);

    const buttonGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.05, 12);
    const buttonMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const button = new THREE.Mesh(buttonGeo, buttonMat);
    button.rotation.x = Math.PI / 2;
    button.position.z = 0.33;
    ballGroup.add(button);

    scene.add(ballGroup);
    sceneRefs.current.pokeballMesh = ballGroup;

    // 9. Atmospheric Floating Embers / Dust Particles
    const particleCount = 70;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 16;
      particlePositions[i * 3 + 1] = Math.random() * 5 + 0.2;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0xffaa44,
      size: 0.08,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    sceneRefs.current.particles = particles;

    // 10. Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 11. Animation Loop with Software WebGL Guard & Clock
    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (isDisposed) return;

      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();

      // Flickering torches with organic jitter
      torchLights.forEach((light, i) => {
        const flicker = Math.sin(elapsed * 9 + i * 2.3) * 0.35 + Math.cos(elapsed * 15 + i) * 0.25;
        light.intensity = 3.5 + flicker;
      });

      // Gently animate rising embers
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] += delta * 0.45;
        positions[i * 3] += Math.sin(elapsed + i) * delta * 0.1;
        if (positions[i * 3 + 1] > 5.5) {
          positions[i * 3 + 1] = 0.2;
          positions[i * 3] = (Math.random() - 0.5) * 16;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 16;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      // Billboards face camera on Y axis
      if (playerMesh && oppMesh && camera) {
        playerMesh.rotation.y = Math.atan2(camera.position.x - playerMesh.position.x, camera.position.z - playerMesh.position.z);
        oppMesh.rotation.y = Math.atan2(camera.position.x - oppMesh.position.x, camera.position.z - oppMesh.position.z);
      }

      // Smooth camera transition to target presets
      let targetX = -2;
      let targetY = 5.2;
      let targetZ = 8.5;
      let lookX = 0;
      let lookY = 1.2;
      let lookZ = 0;

      if (cameraPreset === 'action') {
        // Dramatic low-angle battle view
        targetX = -1.2;
        targetY = 2.4;
        targetZ = 5.2;
        lookX = 1.0;
        lookY = 1.5;
        lookZ = -1.0;
      } else if (cameraPreset === 'tactical') {
        // High isometric tactical diorama
        targetX = 0;
        targetY = 9.0;
        targetZ = 7.0;
        lookX = 0;
        lookY = 0.8;
        lookZ = 0;
      }

      // Add gentle idle camera sway
      const idleSwayX = Math.sin(elapsed * 0.6) * 0.15;
      const idleSwayY = Math.cos(elapsed * 0.8) * 0.08;

      camera.position.x = THREE.MathUtils.damp(camera.position.x, targetX + idleSwayX, 3.5, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, targetY + idleSwayY, 3.5, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, targetZ, 3.5, delta);

      _targetCamLook.set(lookX, lookY, lookZ);
      camera.lookAt(_targetCamLook);

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    // 12. Cleanup
    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      if (isSoftwareGl) {
        clearTimeout(frameId);
      } else {
        cancelAnimationFrame(frameId);
      }

      floorGeo.dispose();
      floorMat.dispose();
      floorTex.dispose();
      wallTex.dispose();
      flameTex.dispose();
      contactShadowTex.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Pokémon Textures when player or opponent changes
  useEffect(() => {
    if (!sceneRefs.current.playerMat || !sceneRefs.current.opponentMat) return;

    const loader = textureLoaderRef.current;

    // Load Player Sprite (Back angle in battle for classic authentic view)
    const pUrl = getPokemonSpriteUrl(playerPokemon, true);
    loader.load(pUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      if (sceneRefs.current.playerMat) {
        sceneRefs.current.playerMat.map = tex;
        sceneRefs.current.playerMat.needsUpdate = true;
      }
    });

    // Load Opponent Sprite
    const oUrl = getPokemonSpriteUrl(opponentPokemon, false);
    loader.load(oUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      if (sceneRefs.current.opponentMat) {
        sceneRefs.current.opponentMat.map = tex;
        sceneRefs.current.opponentMat.needsUpdate = true;
      }
    });
  }, [playerPokemon.speciesId, playerPokemon.isShiny, opponentPokemon.speciesId, opponentPokemon.isShiny]);

  // Handle Shake / Recoil Reactions
  useEffect(() => {
    if (shakeTarget === 'player' && sceneRefs.current.playerMesh) {
      const mesh = sceneRefs.current.playerMesh;
      mesh.position.x = -2.7;
      mesh.position.y = 1.3;
      setTimeout(() => {
        mesh.position.x = -2.4;
        mesh.position.y = 1.45;
      }, 160);
    } else if (shakeTarget === 'opponent' && sceneRefs.current.opponentMesh) {
      const mesh = sceneRefs.current.opponentMesh;
      mesh.position.x = 2.7;
      mesh.position.y = 1.6;
      setTimeout(() => {
        mesh.position.x = 2.4;
        mesh.position.y = 1.45;
      }, 160);
    }
  }, [shakeTarget]);

  // Handle Pokeball Catch Animation in 3D
  useEffect(() => {
    const oppMesh = sceneRefs.current.opponentMesh;
    const ball = sceneRefs.current.pokeballMesh;
    if (!oppMesh || !ball) return;

    if (isCatching) {
      oppMesh.visible = false;
      ball.visible = true;
      ball.rotation.z = Math.sin(catchShakes * 1.5) * 0.45;
    } else {
      oppMesh.visible = true;
      ball.visible = false;
      ball.rotation.z = 0;
    }
  }, [isCatching, catchShakes]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-auto">
      {/* 3D WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Camera Mode Quick Control Pill (Discrete HD-2D UX per guidelines) */}
      <div className="absolute top-16 right-4 z-20 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-700/80 text-xs shadow-lg">
        <span className="text-amber-400 font-bold">視角:</span>
        <button
          onClick={onCycleCamera}
          className="text-slate-200 hover:text-white font-medium hover:underline cursor-pointer flex items-center gap-1"
        >
          {cameraPreset === 'isometric' && '📐 經典斜角'}
          {cameraPreset === 'action' && '⚔️ 特寫特寫'}
          {cameraPreset === 'tactical' && '🗺️ 俯瞰戰術'}
        </button>
      </div>
    </div>
  );
};
