import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { createEnemyPresentation, getEnemyWeaponForward, updateEnemyEngineGlows } from "../enemyPresentation";
import { PreviewFactoryContext, PreviewHandle } from "../objectPreviewTypes";
import { loadSpacecraftAsset } from "../spacecraftAsset";

type PreviewProjectile = {
  life: number;
  material: StandardMaterial;
  mesh: Mesh;
  velocity: Vector3;
};

export async function createEnemyPreview(context: PreviewFactoryContext): Promise<PreviewHandle> {
  const asset = await loadSpacecraftAsset(context.scene);
  const presentation = createEnemyPresentation(context.scene, context.root, asset, {
    includeMarkers: true,
    markerVisibility: context.initialMarkers,
  });
  const projectiles: PreviewProjectile[] = [];
  let lightsEnabled = true;
  let markersEnabled = context.initialMarkers;

  context.root.rotation.y = Math.PI;

  const syncLights = (): void => {
    for (const glow of presentation.engineGlows) {
      glow.mesh.setEnabled(lightsEnabled);
    }
  };

  const syncMarkers = (): void => {
    for (const marker of presentation.markerMeshes) {
      marker.setEnabled(markersEnabled);
    }
  };

  const fireBurst = (): void => {
    const direction = getEnemyWeaponForward(context.root, presentation.weaponMounts);
    for (const mount of presentation.weaponMounts) {
      const material = new StandardMaterial(`preview-enemy-bullet-${performance.now()}`, context.scene);
      material.disableLighting = true;
      material.emissiveColor = new Color3(1, 0.42, 0.18);
      material.diffuseColor = new Color3(0.96, 0.32, 0.14);

      const mesh = MeshBuilder.CreateSphere(
        `preview-enemy-bullet-${performance.now()}`,
        { diameter: 0.18, segments: 8 },
        context.scene,
      );
      mesh.position.copyFrom(mount.getAbsolutePosition().add(direction.scale(0.4)));
      mesh.material = material;
      mesh.isPickable = false;

      projectiles.push({
        life: 0.75,
        material,
        mesh,
        velocity: direction.scale(18),
      });
    }
  };

  syncLights();
  syncMarkers();

  return {
    actions: () => [
      { id: "lights", label: "Lights", kind: "toggle", active: lightsEnabled },
      { id: "fire", label: "Fire", kind: "button" },
      { id: "markers", label: "Markers", kind: "toggle", active: markersEnabled },
    ],
    invoke: (actionId, nextActive) => {
      if (actionId === "lights") {
        lightsEnabled = nextActive ?? !lightsEnabled;
        syncLights();
        return;
      }

      if (actionId === "markers") {
        markersEnabled = nextActive ?? !markersEnabled;
        syncMarkers();
        return;
      }

      if (actionId === "fire") {
        fireBurst();
      }
    },
    update: (dt, timeMs) => {
      if (lightsEnabled) {
        updateEnemyEngineGlows(presentation.engineGlows, 0.84, timeMs);
      }

      for (let index = projectiles.length - 1; index >= 0; index -= 1) {
        const projectile = projectiles[index];
        projectile.life -= dt;
        projectile.mesh.position.addInPlace(projectile.velocity.scale(dt));
        if (projectile.life > 0) {
          continue;
        }

        projectile.mesh.dispose();
        projectile.material.dispose();
        projectiles.splice(index, 1);
      }
    },
    dispose: () => {
      for (const projectile of projectiles) {
        projectile.mesh.dispose();
        projectile.material.dispose();
      }
      projectiles.length = 0;
      presentation.dispose();
      asset.dispose();
    },
  };
}
