import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { DungeonNode, PokemonInstance } from '../types/pokemon';
import { POKEMON_SPECIES } from '../data/pokemonData';
import {
  isSoftwareGl,
  createStoneFloorTexture,
  createStoneWallTexture,
  createContactShadowTexture,
  createTorchFlameTexture,
} from '../utils/hd2dTextures';

interface HD2DDungeonSceneProps {
  currentFloor: number;
  totalFloors: number;
  nodes: DungeonNode[];
  leadPokemon?: PokemonInstance;
  onSelectNode: (node: DungeonNode) => void;
}

export const HD2DDungeonScene: React.FC<HD2DDungeonSceneProps> = ({
  currentFloor,
  nodes,
  leadPokemon,
  onSelectNode,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const textureLoaderRef = useRef<THREE.TextureLoader>(new THREE.TextureLoader());

  const sceneRefs = useRef<{
    leadSpriteMat?: THREE.MeshStandardMaterial;
    leadMesh?: THREE.Mesh;
    torchLights: THREE.PointLight[];
    nodeMeshes: { id: string; mesh: THREE.Group; node: DungeonNode }[];
  }>({
    torchLights: [],
    nodeMeshes: [],
  });

  const getPokemonSpriteUrl = (pkm?: PokemonInstance) => {
    if (!pkm) return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png';
    const dexNo = pkm.pokedexNo || POKEMON_SPECIES[pkm.speciesId]?.pokedexNo || 25;
    return pkm.isShiny
      ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/${dexNo}.png`
      : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dexNo}.png`;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d14);
    scene.fog = new THREE.FogExp2(0x0a0d14, 0.04);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 8.5, 11);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 2. RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x28354d, 0x0a0e16, 1.2);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.0);
    keyLight.position.set(6, 14, 8);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    // 4. Ground Diorama
    const floorTex = createStoneFloorTexture();
    floorTex.repeat.set(8, 8);
    floorTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    const floorGeo = new THREE.PlaneGeometry(28, 28);
    const floorMat = new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.88,
      metalness: 0.1,
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMesh);

    // Back stone ruins
    const wallTex = createStoneWallTexture();
    wallTex.repeat.set(10, 2);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(28, 5, 1), wallMat);
    backWall.position.set(0, 2.5, -9);
    backWall.receiveShadow = !isSoftwareGl;
    scene.add(backWall);

    // 5. Build 3D Node Altars
    const nodeMeshes: { id: string; mesh: THREE.Group; node: DungeonNode }[] = [];
    const contactShadowTex = createContactShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(2.5, 2.5);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: contactShadowTex,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
    });

    const nodeCount = nodes.length;
    const spacing = 3.6;
    const startX = -((nodeCount - 1) * spacing) / 2;

    nodes.forEach((node, idx) => {
      const nodeGroup = new THREE.Group();
      const nx = startX + idx * spacing;
      const nz = (idx % 2 === 1 ? -0.8 : 0.8);
      nodeGroup.position.set(nx, 0, nz);

      // Shadow
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.02;
      nodeGroup.add(shadow);

      // Stone Pedestal
      const baseGeo = new THREE.CylinderGeometry(1.2, 1.4, 0.4, 16);
      let altarColor = 0x334155;
      if (node.type === 'battle') altarColor = 0x991b1b;
      if (node.type === 'trainer') altarColor = 0xb45309;
      if (node.type === 'camp') altarColor = 0x065f46;
      if (node.type === 'shop') altarColor = 0x075985;
      if (node.type === 'event') altarColor = 0x6b21a8;
      if (node.type === 'boss') altarColor = 0x881337;

      const baseMat = new THREE.MeshStandardMaterial({
        color: altarColor,
        roughness: 0.6,
        metalness: 0.2,
      });
      const pedestal = new THREE.Mesh(baseGeo, baseMat);
      pedestal.position.y = 0.2;
      pedestal.castShadow = !isSoftwareGl;
      pedestal.receiveShadow = !isSoftwareGl;
      nodeGroup.add(pedestal);

      // Altar Emblem / Totem in 3D
      if (node.type === 'boss') {
        const bossTotem = new THREE.Mesh(
          new THREE.ConeGeometry(0.7, 1.8, 8),
          new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.3, emissive: 0x881337 })
        );
        bossTotem.position.y = 1.3;
        bossTotem.castShadow = !isSoftwareGl;
        nodeGroup.add(bossTotem);
      } else if (node.type === 'camp') {
        const tentGeo = new THREE.ConeGeometry(0.8, 1.2, 4);
        const tent = new THREE.Mesh(
          tentGeo,
          new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.7 })
        );
        tent.position.y = 1.0;
        tent.rotation.y = Math.PI / 4;
        tent.castShadow = !isSoftwareGl;
        nodeGroup.add(tent);
      } else {
        const obeliskGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5);
        const obelisk = new THREE.Mesh(
          obeliskGeo,
          new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5 })
        );
        obelisk.position.y = 1.0;
        obelisk.castShadow = !isSoftwareGl;
        nodeGroup.add(obelisk);
      }

      // Beacon PointLight
      let lightColor = 0x38bdf8;
      if (node.type === 'battle' || node.type === 'boss') lightColor = 0xf43f5e;
      if (node.type === 'trainer') lightColor = 0xfbbf24;
      if (node.type === 'camp') lightColor = 0x34d399;
      if (node.type === 'shop') lightColor = 0x38bdf8;
      if (node.type === 'event') lightColor = 0xc084fc;

      const pLight = new THREE.PointLight(lightColor, 2.0, 4.5);
      pLight.position.set(0, 1.8, 0);
      nodeGroup.add(pLight);

      scene.add(nodeGroup);
      nodeMeshes.push({ id: node.id, mesh: nodeGroup, node });
    });

    sceneRefs.current.nodeMeshes = nodeMeshes;

    // 6. Player Billboard Sprite standing on the first accessible node
    const leadSpriteGeo = new THREE.PlaneGeometry(2.0, 2.0);
    const leadSpriteMat = new THREE.MeshStandardMaterial({
      transparent: true,
      alphaTest: 0.15,
      roughness: 0.8,
      side: THREE.DoubleSide,
    });
    sceneRefs.current.leadSpriteMat = leadSpriteMat;

    const leadMesh = new THREE.Mesh(leadSpriteGeo, leadSpriteMat);
    const firstActiveNode = nodes.find((n) => n.accessible) || nodes[0];
    const initialIndex = nodes.indexOf(firstActiveNode);
    const leadX = startX + (initialIndex >= 0 ? initialIndex : 0) * spacing;
    const leadZ = initialIndex % 2 === 1 ? -0.8 : 0.8;
    leadMesh.position.set(leadX, 1.25, leadZ + 1.2);
    leadMesh.castShadow = !isSoftwareGl;
    scene.add(leadMesh);
    sceneRefs.current.leadMesh = leadMesh;

    // 7. Raycaster for clicking 3D nodes
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      if (intersects.length > 0) {
        let obj: THREE.Object3D | null = intersects[0].object;
        while (obj && obj.parent && obj.parent !== scene) {
          obj = obj.parent;
        }
        if (obj) {
          const match = nodeMeshes.find((nm) => nm.mesh === obj);
          if (match && match.node.accessible && !match.node.completed) {
            onSelectNode(match.node);
          }
        }
      }
    };

    renderer.domElement.addEventListener('click', handleClick);

    // 8. Animation Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let isDisposed = false;

    const tick = () => {
      if (isDisposed) return;
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Billboards face camera
      if (leadMesh && camera) {
        leadMesh.rotation.y = Math.atan2(camera.position.x - leadMesh.position.x, camera.position.z - leadMesh.position.z);
      }

      // Subtle float on node totems
      nodeMeshes.forEach((nm, i) => {
        const topPart = nm.mesh.children[2];
        if (topPart) {
          topPart.position.y = 1.0 + Math.sin(elapsed * 2.5 + i) * 0.08;
        }
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        frameId = window.setTimeout(tick, 80);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    // Resize
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isDisposed = true;
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);

      floorGeo.dispose();
      floorMat.dispose();
      floorTex.dispose();
      wallTex.dispose();
      contactShadowTex.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [currentFloor, nodes]);

  // Load Lead Pokemon sprite
  useEffect(() => {
    if (!sceneRefs.current.leadSpriteMat) return;
    const url = getPokemonSpriteUrl(leadPokemon);
    textureLoaderRef.current.load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      if (sceneRefs.current.leadSpriteMat) {
        sceneRefs.current.leadSpriteMat.map = tex;
        sceneRefs.current.leadSpriteMat.needsUpdate = true;
      }
    });
  }, [leadPokemon?.speciesId, leadPokemon?.isShiny]);

  return (
    <div className="w-full h-72 sm:h-80 md:h-96 relative rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl bg-slate-950">
      <div ref={mountRef} className="w-full h-full cursor-pointer" />
      <div className="absolute bottom-3 left-4 pointer-events-none z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-xs text-slate-300">
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span>HD-2D 3D 立體探索沙盤：點擊發光祭壇即可進入冒險</span>
      </div>
    </div>
  );
};
