import * as React from "react";

const RecommendationDocumentContext = React.createContext(false);

/**
 * Active le rendu type « compte-rendu » (fond blanc, texte foncé) pour les
 * cartes et sections enfants — utilisé dans l’onglet Recommandations de l’analyse.
 */
export function RecommendationDocumentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RecommendationDocumentContext.Provider value={true}>
      {children}
    </RecommendationDocumentContext.Provider>
  );
}

export function useIsRecommendationDocumentSurface(): boolean {
  return React.useContext(RecommendationDocumentContext);
}
