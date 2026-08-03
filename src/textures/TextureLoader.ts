/**
 * GlobeTextureLoader -- CDN texture loading with retry, caching, and fallback.
 *
 * Loads Earth texture maps (day, night, elevation) from remote URLs with:
 *   - Automatic retry with exponential backoff (3 attempts)
 *   - In-memory caching of loaded textures
 *   - Progress tracking for aggregate load completion
 *   - AbortController support for cancellation
 *   - Graceful fallback to solid-color textures on failure
 *
 * Texture properties are configured for Earth rendering:
 *   - sRGB color space for proper gamma
 *   - Repeat wrapping for seamless edges
 *   - Linear mipmap filtering for distance
 *   - Anisotropic filtering for sharpness at grazing angles
 */
import * as THREE from 'three';

export interface TextureConfig {
  /** URL for the day (Blue Marble) texture */
  day: string;
  /** URL for the night (city lights) texture */
  night: string;
  /** URL for the elevation/displacement texture (optional) */
  elevation?: string;
}

export interface LoadedTextures {
  day: THREE.Texture;
  night: THREE.Texture;
  elevation?: THREE.Texture;
}

export interface LoadProgress {
  loaded: number;
  total: number;
}

export interface TextureLoadOptions {
  /** Number of retry attempts (default: 3) */
  retries?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/** Default Earth texture URLs from Three.js examples (planets subdirectory) */
export const DEFAULT_TEXTURES: TextureConfig = {
  day: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_day_4096.jpg',
  night: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_night_4096.jpg',
  elevation: 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_bump_roughness_clouds_4096.jpg',
};

/**
 * Texture loader with retry, caching, and fallback support.
 */
export class GlobeTextureLoader {
  private anisotropy: number = 1;
  private cache: Map<string, THREE.Texture> = new Map();
  private textureLoader: THREE.TextureLoader = new THREE.TextureLoader();

  /** Sets the maximum anisotropy level for loaded textures. */
  setMaxAnisotropy(value: number): void {
    this.anisotropy = value;
  }

  /** Clears the in-memory texture cache. */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Loads all textures in a config concurrently.
   *
   * @param config - Texture URLs to load
   * @param onProgress - Called after each texture loads with aggregate progress
   * @param signal - Optional abort signal
   * @returns Loaded textures, with fallbacks for any that failed
   */
  async loadAll(
    config: TextureConfig,
    onProgress?: (progress: LoadProgress) => void,
    signal?: AbortSignal,
  ): Promise<LoadedTextures> {
    const entries: Array<[keyof LoadedTextures, string]> = [
      ['day', config.day],
      ['night', config.night],
    ];
    if (config.elevation) {
      entries.push(['elevation', config.elevation]);
    }

    let loaded = 0;
    const total = entries.length;
    const results: Partial<LoadedTextures> = {};

    await Promise.all(entries.map(async ([key, url]) => {
      try {
        results[key] = await this.loadTexture(url, { signal });
      } catch {
        // Fallback to solid-color texture
        results[key] = this.createFallbackTexture(
          key === 'day'
            ? 0x1a3a5c
            : key === 'night'
              ? 0x081a2c
              : 0x808080,
        );
      }
      loaded++;
      onProgress?.({ loaded, total });
    }));

    return results as LoadedTextures;
  }

  /**
   * Loads a single texture with retry and caching.
   *
   * @param url - Texture URL
   * @param options - Load options (retries, abort signal)
   * @returns Loaded texture
   * @throws If the texture fails to load after all retry attempts
   */
  async loadTexture(url: string, options?: TextureLoadOptions): Promise<THREE.Texture> {
    const retries = options?.retries ?? 3;
    const signal = options?.signal;

    // Return cached texture if available
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      if (signal?.aborted) {
        throw new Error('Texture load aborted');
      }

      try {
        const texture = await this.loadTextureOnce(url, signal);
        this.cache.set(url, texture);
        return texture;
      } catch (err) {
        lastError = err as Error;
        // Exponential backoff before retry
        if (attempt < retries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 500),
          );
        }
      }
    }

    throw lastError ?? new Error(`Failed to load texture after ${retries} attempts`);
  }

  /**
   * Fetches a texture from a URL with proper Three.js r185 properties.
   */
  private loadTextureOnce(url: string, signal?: AbortSignal): Promise<THREE.Texture> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Texture load aborted'));
        return;
      }

      this.textureLoader.load(
        url,
        (texture: THREE.Texture) => {
          // Configure texture properties for Earth rendering
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.anisotropy = this.anisotropy;
          texture.needsUpdate = true;

          if (signal?.aborted) {
            reject(new Error('Texture load aborted'));
            return;
          }

          resolve(texture);
        },
        undefined, // onProgress (not needed for single texture)
        (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
      );
    });
  }

  /**
   * Creates a 1x1 solid-color fallback texture.
   * Used when a texture fails to load.
   *
   * @param color - The solid color for the fallback
   * @returns A 1x1 DataTexture
   */
  createFallbackTexture(color: THREE.ColorRepresentation): THREE.DataTexture {
    const c = new THREE.Color(color);
    const r = Math.floor(c.r * 255);
    const g = Math.floor(c.g * 255);
    const b = Math.floor(c.b * 255);

    const texture = new THREE.DataTexture(
      new Uint8Array([r, g, b, 255]),
      1,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    texture.needsUpdate = true;
    return texture;
  }
}
