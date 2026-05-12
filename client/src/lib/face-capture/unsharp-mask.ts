// ============================================================
// Unsharp mask — netteté appliquée aux captures JPEG
// ============================================================
//
// Émule le slider « Netteté » d’Apple (`CISharpenLuminance`) : on
// soustrait une version floue à l’image source pour récupérer la
// **haute fréquence**, qu’on réinjecte multipliée par `amount`.
// L’algorithme est appliqué *avant* l’encodage JPEG, donc :
//
//   • les 8 photos envoyées à l’API d’analyse (FACE_FRONT, PROFILE_*,
//     LOOK_UP, SMILE, EYE_CLOSEUP) en bénéficient automatiquement —
//     elles transitent toutes par `CameraManager._encodeBoundedJpeg`.
//   • les 14 PNG « guide trace » composés par `encodeAdminGuideFlattenedPair`
//     re-décodent ce **même** blob (`createImageBitmap(opts.photoBlob)`)
//     et dessinent leurs traits par-dessus → ils héritent gratuitement
//     de la netteté sans appel supplémentaire.
//
// Le flou de référence est délégué au GPU (`ctx.filter = 'blur(Rpx)'`),
// la combinaison RGB se fait en `ImageData` (boucle linéaire ~50 ms
// par capture sur ≤ 1600×1200). Aucune modification de la luminance
// uniquement (RGB direct) : suffisant ici puisqu’on calibre pour un
// effet doux et qu’on ne fait qu’une seule passe.
//
// Ne pas confondre avec un filtre « définition » (clarity / micro-
// contraste) : ici on cible uniquement les arêtes fines.

/** Paramètres déclaratifs d’un passage unsharp mask. */
export type UnsharpMaskParams = {
  /**
   * Rayon (σ) du flou gaussien sous-jacent en pixels. Petit → met en
   * valeur le détail fin (pores, cils) ; grand → renforce les transitions
   * larges (mâchoire, nez) au risque d’un effet « HDR ».
   */
  radiusPx: number;
  /**
   * Multiplicateur appliqué à la couche haute fréquence
   * (`src - blur`). 0 = neutre, 1.0 ≈ Apple « Netteté 100 ».
   * Au-delà de ~1.3 les halos d’overshoot deviennent visibles.
   */
  amount: number;
};

/**
 * Profil unique utilisé pour TOUTES les captures sortant du
 * `CameraManager` (donc analyse + guide traces). Calibré pour
 * uniformiser des caméras tendant au « doux » (caméra frontale iPhone)
 * sans introduire d’artefacts visibles sur peau / cheveux.
 */
export const ANALYSIS_CAPTURE_UNSHARP_MASK: UnsharpMaskParams = {
  radiusPx: 0.7,
  amount: 0.85,
};

/**
 * Applique un unsharp mask **en place** sur les pixels d’un canvas 2D.
 *
 * Pré-conditions :
 *   • le canvas doit être same-origin (pas d’image CORS tainted) —
 *     dans notre flux il est dessiné à partir d’un `<video>` local ou
 *     d’un `ImageBitmap` interne, jamais d’un blob distant.
 *   • `ctx` doit être le 2D context de `canvas` (on lit / réécrit ses pixels).
 *
 * En cas d’environnement dégradé (filtre CSS non supporté, contexte
 * indisponible, dimensions < 2 px) on n’effectue **aucune** modification —
 * l’image originale est conservée plutôt qu’abîmée.
 */
export function applyUnsharpMaskInPlace(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  params: UnsharpMaskParams,
): void {
  const { radiusPx, amount } = params;
  if (amount <= 0 || radiusPx <= 0) return;

  const w = canvas.width;
  const h = canvas.height;
  if (w < 2 || h < 2) return;

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = w;
  blurCanvas.height = h;
  const blurCtx = blurCanvas.getContext('2d');
  if (!blurCtx) return;

  /**
   * `ctx.filter` est supporté partout sauf Safari < 15. Sur les rares
   * UA qui ignorent la propriété, `filter` reste `'none'` après
   * assignation → on évite alors la passe (qui ne ferait que recopier
   * l’image source et soustraire à elle-même = identité).
   */
  blurCtx.filter = `blur(${radiusPx}px)`;
  if (blurCtx.filter === 'none' && radiusPx > 0) return;
  blurCtx.drawImage(canvas, 0, 0);

  let origImage: ImageData;
  let blurImage: ImageData;
  try {
    origImage = ctx.getImageData(0, 0, w, h);
    blurImage = blurCtx.getImageData(0, 0, w, h);
  } catch {
    return;
  }

  const dst = origImage.data;
  const blr = blurImage.data;
  /**
   * Boucle « tight » sur le buffer plat (Uint8ClampedArray). On lit/écrit
   * sur `dst` directement (le canal alpha à i+3 reste intact). La saturation
   * automatique du type évite un clamp manuel.
   */
  for (let i = 0; i < dst.length; i += 4) {
    const r = dst[i];
    const g = dst[i + 1];
    const b = dst[i + 2];
    dst[i] = r + amount * (r - blr[i]);
    dst[i + 1] = g + amount * (g - blr[i + 1]);
    dst[i + 2] = b + amount * (b - blr[i + 2]);
  }

  ctx.putImageData(origImage, 0, 0);
}
