import { cn } from '@/lib/utils';

/**
 * Guide visuel pour l’étape « visage de face » : silhouette frontale + zone de masque
 * blanche unie (sans lignes de grille / repères), distincte du rendu live MediaPipe.
 */
export function FaceCaptureFrontalMaskGuideSvg({
  className,
  title,
}: {
  className?: string;
  /** Titre optionnel pour accessibilité si le pictogramme est hors contexte parlant. */
  title?: string;
}) {
  return (
    <svg
      className={cn('shrink-0', className)}
      viewBox="0 0 120 148"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-labelledby={title ? 'face-capture-frontal-mask-guide-title' : undefined}
    >
      {title ? (
        <title id="face-capture-frontal-mask-guide-title">{title}</title>
      ) : null}

      {/* Contour tête / cheveux — discret, lecture secondaire par rapport au masque */}
      <path
        fill="rgba(255,255,255,0.08)"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1.25"
        d="M60 8c-26 0-44 18-44 46v6c0 8 2 16 6 23-2 10-4 22-4 34v6h84v-6c0-12-2-24-4-34 4-7 6-15 6-23v-6c0-28-18-46-44-46z"
      />

      {/* Visage de base (léger contraste sous le masque) */}
      <path
        fill="rgba(255,220,200,0.22)"
        d="M60 24c-21.5 0-36 13.5-36 38 0 26 14.5 44 36 44s36-18 36-44c0-24.5-14.5-38-36-38z"
      />

      {/* Masque blanc unifié (aucun trait intérieur / grille) */}
      <ellipse
        cx="60"
        cy="74"
        rx="28"
        ry="38"
        fill="rgba(255,255,255,0.94)"
        stroke="rgba(255,255,255,0.98)"
        strokeWidth="0.85"
      />
    </svg>
  );
}
