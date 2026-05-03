export type FaceAnalysisLocale = "fr" | "en";

export const DEFAULT_FACE_ANALYSIS_LOCALE: FaceAnalysisLocale = "fr";

export type LocalizedText = {
  fr: string;
  en?: string;
};

export type AggregateDisplayKind = "score" | "enum" | "number" | "boolean" | "text" | "list";

export type AggregateDisplayMeta = {
  label: LocalizedText;
  description?: LocalizedText;
  kind?: AggregateDisplayKind;
  priority: number;
  hidden?: boolean;
  valueLabels?: Record<string, LocalizedText>;
};

export type AggregateDisplayEntry = {
  key: string;
  label: string;
  value: string;
  argument: string | null;
  description: string | null;
};

type WorkerDisplayMeta = {
  label: LocalizedText;
  aggregates?: Record<string, AggregateDisplayMeta>;
};

function text(fr: string, en?: string): LocalizedText {
  return en ? { fr, en } : { fr };
}

function resolveLocalizedText(
  value: LocalizedText | undefined,
  locale: FaceAnalysisLocale,
): string | undefined {
  return value?.[locale] ?? value?.fr;
}

const workerLabels: Record<string, LocalizedText> = {
  age: text("Âge apparent", "Apparent age"),
  bodyfat: text("Masse grasse faciale", "Facial body fat"),
  cheeks: text("Joues", "Cheeks"),
  chin: text("Menton", "Chin"),
  coloring: text("Ta colorimétrie globale", "Your global coloring"),
  ear: text("Oreilles", "Ears"),
  eye_brows: text("Sourcils", "Eyebrows"),
  eyes: text("Yeux", "Eyes"),
  hair: text("Cheveux", "Hair"),
  jaw: text("Mâchoire", "Jaw"),
  lips: text("Lèvres", "Lips"),
  neck: text("Cou", "Neck"),
  nose: text("Nez", "Nose"),
  skin: text("Ton profil de peau", "Your skin profile"),
  skin_tint: text("Teint", "Skin tone"),
  smile: text("Sourire", "Smile"),
  symmetry_shape: text("Symétrie et forme", "Symmetry and shape"),
};

const commonEnumLabels: Record<string, LocalizedText> = {
  oval: text("Ovale", "Oval"),
  round: text("Ronde", "Round"),
  square: text("Carrée", "Square"),
  heart: text("Cœur", "Heart"),
  diamond: text("Diamant", "Diamond"),
  oblong: text("Allongée", "Oblong"),
  long: text("Allongée", "Long"),
  balanced: text("Équilibré", "Balanced"),
  neutral: text("Neutre", "Neutral"),
  positive: text("Positive", "Positive"),
  negative: text("Négative", "Negative"),
  high: text("Élevé", "High"),
  medium: text("Moyen", "Medium"),
  low: text("Faible", "Low"),
  present: text("Présent", "Present"),
  absent: text("Absent", "Absent"),
  faint: text("Discret", "Faint"),
  prominent: text("Marqué", "Prominent"),
  almond: text("Amande", "Almond"),
  hooded: text("Paupière tombante", "Hooded"),
  monolid: text("Monopaupière", "Monolid"),
  downturned: text("Tombants", "Downturned"),
  deep_set: text("Enfoncés", "Deep-set"),
  close_set: text("Rapprochés", "Close-set"),
  wide_set: text("Écartés", "Wide-set"),
  straight: text("Droit", "Straight"),
  soft_arch: text("Arc doux", "Soft arch"),
  high_arch: text("Arc haut", "High arch"),
  rounded: text("Arrondi", "Rounded"),
  squared: text("Carré", "Squared"),
  wavy: text("Ondulé", "Wavy"),
  curly: text("Bouclé", "Curly"),
  thin: text("Fin", "Thin"),
  full: text("Plein", "Full"),
  clear: text("Clair", "Clear"),
  uneven: text("Irrégulier", "Uneven"),
  irregular: text("Irrégulier", "Irregular"),
  attached: text("Attaché", "Attached"),
  free: text("Libre", "Free"),
  deformed: text("Déformé", "Deformed"),
  pointed: text("Pointu", "Pointed"),
  smooth_c: text("Contour en C lisse", "Smooth C"),
  subtle: text("Subtil", "Subtle"),
  faded: text("Estompé", "Faded"),
  short: text("Court", "Short"),
  tapered: text("Effilée", "Tapered"),
  lean_athletic: text("Mince athlétique", "Lean athletic"),
  athletic_lean: text("Athlétique et sec", "Athletic lean"),
  type_2: text("Type 2", "Type 2"),
  cool: text("Froid", "Cool"),
  partial: text("Partielle", "Partial"),
  very_fair: text("Très clair", "Very fair"),
  fair: text("Clair", "Fair"),
  olive: text("Olive", "Olive"),
  tan: text("Hâlé", "Tan"),
  dark: text("Foncé", "Dark"),
  black: text("Noir", "Black"),
  dark_brown: text("Brun foncé", "Dark brown"),
  medium_brown: text("Brun moyen", "Medium brown"),
  light_brown: text("Brun clair", "Light brown"),
  dark_blonde: text("Blond foncé", "Dark blonde"),
  blonde: text("Blond", "Blonde"),
  light_blonde: text("Blond clair", "Light blonde"),
  red: text("Roux", "Red"),
  grey: text("Gris", "Grey"),
  white: text("Blanc", "White"),
  hazel: text("Noisette", "Hazel"),
  green: text("Vert", "Green"),
  blue: text("Bleu", "Blue"),
  blue_grey: text("Bleu-gris", "Blue grey"),
  light_blue: text("Bleu clair", "Light blue"),
  dark_blue: text("Bleu foncé", "Dark blue"),
  grey_blue: text("Gris-bleu", "Grey blue"),
  pure_grey: text("Gris pur", "Pure grey"),
  light_green: text("Vert clair", "Light green"),
  dark_green: text("Vert foncé", "Dark green"),
  hazel_green: text("Noisette vert", "Hazel green"),
  hazel_brown: text("Noisette brun", "Hazel brown"),
  amber: text("Ambre", "Amber"),
  almost_black: text("Presque noir", "Almost black"),
  central_heterochromia: text("Hétérochromie centrale", "Central heterochromia"),
  sectoral_heterochromia: text("Hétérochromie sectorielle", "Sectoral heterochromia"),
  very_pale: text("Très pâle", "Very pale"),
  pale_pink: text("Rose pâle", "Pale pink"),
  pink: text("Rose", "Pink"),
  rose: text("Rosé", "Rose"),
  deep_red: text("Rouge profond", "Deep red"),
  nude: text("Nude", "Nude"),
};

const displayMeta: Record<string, WorkerDisplayMeta> = {
  age: {
    label: text("Âge apparent", "Apparent age"),
    aggregates: {
      "age_analysis.best_estimated_age": {
        label: text("Âge estimé", "Estimated age"),
        description: text(
          "Lecture de l'âge apparent à partir des marqueurs visuels détectés.",
          "Apparent age reading derived from detected visual markers.",
        ),
        kind: "score",
        priority: 10,
      },
      "age_analysis.age_argument": {
        label: text("Synthèse de l'âge", "Age summary"),
        kind: "enum",
        priority: 20,
      },
      "facial_neoteny_and_fat.juvenile_fat_retention_roundness": {
        label: text("Rondeur du visage", "Juvenile fat retention"),
        kind: "score",
        priority: 30,
      },
      "facial_neoteny_and_fat.lower_face_softness": {
        label: text("Douceur du bas du visage", "Lower face softness"),
        kind: "score",
        priority: 40,
      },
      "skin_quality_and_plumpness.epidermal_plumpness_baby_skin": {
        label: text("Élasticité de la peau", "Epidermal plumpness"),
        kind: "score",
        priority: 50,
      },
      "skin_quality_and_plumpness.periorbital_freshness": {
        label: text("Fraîcheur du contour des yeux", "Periorbital freshness"),
        kind: "score",
        priority: 60,
      },
      "hair_maturation.terminal_facial_hair_presence": {
        label: text("Pilosité faciale adulte", "Terminal facial hair"),
        kind: "score",
        priority: 70,
      },
      "hair_maturation.scalp_hairline_maturation": {
        label: text("Maturation de la ligne capillaire", "Hairline maturation"),
        kind: "score",
        priority: 80,
      },
      "structural_neoteny.lip_plumpness": {
        label: text("Volume des lèvres", "Lip plumpness"),
        kind: "score",
        priority: 90,
      },
      "structural_neoteny.cartilage_proportion": {
        label: text("Proportion des cartilages", "Cartilage proportion"),
        kind: "score",
        priority: 100,
      },
    },
  },
  symmetry_shape: {
    label: text("Symétrie et forme", "Symmetry and shape"),
    aggregates: {
      "face_shape.shape": {
        label: text("Forme du visage", "Face shape"),
        description: text("Catégorie morphologique globale détectée."),
        kind: "enum",
        priority: 10,
        valueLabels: commonEnumLabels,
      },
      overall_face_structure_score: {
        label: text("Structure faciale globale", "Overall facial structure"),
        description: text("Synthèse de la structure, des proportions et de la symétrie."),
        kind: "score",
        priority: 20,
      },
      "symmetry.eye_symmetry": { label: text("Symétrie des yeux", "Eye symmetry"), kind: "score", priority: 30 },
      "symmetry.brow_symmetry": { label: text("Symétrie des sourcils", "Brow symmetry"), kind: "score", priority: 40 },
      "symmetry.nose_midline_alignment": { label: text("Alignement médian du nez", "Nose midline alignment"), kind: "score", priority: 50 },
      "symmetry.mouth_symmetry": { label: text("Symétrie de la bouche", "Mouth symmetry"), kind: "score", priority: 60 },
      "symmetry.jaw_chin_midline": { label: text("Axe mâchoire / menton", "Jaw / chin midline"), kind: "score", priority: 70 },
      "symmetry.cheekbone_balance": { label: text("Équilibre des pommettes", "Cheekbone balance"), kind: "score", priority: 80 },
      "proportions.vertical_thirds_balance": { label: text("Équilibre des tiers verticaux", "Vertical thirds balance"), kind: "score", priority: 90 },
      "proportions.lower_third_subdivision": { label: text("Subdivision du tiers inférieur", "Lower third subdivision"), kind: "score", priority: 100 },
      "proportions.horizontal_fifths_balance": { label: text("Équilibre des cinquièmes horizontaux", "Horizontal fifths balance"), kind: "score", priority: 110 },
      "proportions.eye_to_intercanthal_ratio": { label: text("Rapport œil / distance intercanthale", "Eye / intercanthal ratio"), kind: "score", priority: 120 },
      "proportions.nose_to_inner_eye_alignment": { label: text("Alignement nez / coins internes des yeux", "Nose / inner eye alignment"), kind: "score", priority: 130 },
      "proportions.mouth_to_pupil_alignment": { label: text("Alignement bouche / pupilles", "Mouth / pupil alignment"), kind: "score", priority: 140 },
      "face_shape.forehead_vs_jaw_ratio": { label: text("Rapport front / mâchoire", "Forehead / jaw ratio"), kind: "score", priority: 150 },
      "face_shape.face_length_vs_width_ratio": { label: text("Rapport longueur / largeur", "Face length / width ratio"), kind: "score", priority: 160 },
    },
  },
  bodyfat: {
    label: text("Masse grasse faciale", "Facial body fat"),
    aggregates: {
      "body_fat_estimation.facial_leanness_score": { label: text("Minceur faciale globale", "Facial leanness"), kind: "score", priority: 10 },
      "body_fat_estimation.visual_estimate_tier": {
        label: text("Niveau visuel estimé", "Visual estimate tier"),
        kind: "enum",
        priority: 20,
        valueLabels: {
          obese: text("Obèse", "Obese"),
          overweight: text("Surpoids", "Overweight"),
          average_soft: text("Moyen / doux", "Average soft"),
          athletic_lean: text("Athlétique et sec", "Athletic lean"),
          model_shredded: text("Très sec type modèle", "Model shredded"),
          extreme_gaunt: text("Extrêmement émacié", "Extreme gaunt"),
          lean_athletic: text("Mince athlétique", "Lean athletic"),
          lean: text("Mince", "Lean"),
          average: text("Moyen", "Average"),
          soft: text("Plus doux", "Soft"),
        },
      },
      "lower_face_neck.jawline_definition": { label: text("Définition de la mâchoire", "Jawline definition"), kind: "score", priority: 30 },
      "lower_face_neck.submental_fat_tightness": { label: text("Tension sous le menton", "Submental fat tightness"), kind: "score", priority: 40 },
      "midface_buccal.buccal_leanness": { label: text("Minceur des joues", "Buccal leanness"), kind: "score", priority: 50 },
      "midface_buccal.zygomatic_bone_visibility": { label: text("Visibilité des pommettes", "Zygomatic bone visibility"), kind: "score", priority: 60 },
      "upper_face_skin.periocular_leanness": { label: text("Minceur du contour des yeux", "Periocular leanness"), kind: "score", priority: 70 },
      "upper_face_skin.facial_angularity": { label: text("Angularité du visage", "Facial angularity"), kind: "score", priority: 80 },
    },
  },
  eyes: {
    label: text("Yeux", "Eyes"),
    aggregates: {
      overall_eye_score: { label: text("Score global des yeux", "Overall eye score"), kind: "score", priority: 10 },
      "morphology_and_tilt.canthal_tilt": {
        label: text("Inclinaison canthale", "Canthal tilt"),
        kind: "enum",
        priority: 20,
        valueLabels: commonEnumLabels,
      },
      "morphology_and_tilt.eye_spacing": {
        label: text("Espacement des yeux", "Eye spacing"),
        kind: "score",
        priority: 30,
      },
      "morphology_and_tilt.orbital_depth": {
        label: text("Profondeur orbitale", "Orbital depth"),
        kind: "score",
        priority: 40,
      },
      "morphology_and_tilt.eye_symmetry": { label: text("Symétrie des yeux", "Eye symmetry"), kind: "score", priority: 50 },
      "eyelids_and_sclera.upper_eyelid_exposure": { label: text("Exposition de la paupière supérieure", "Upper eyelid exposure"), kind: "score", priority: 60 },
      "eyelids_and_sclera.lower_scleral_show": { label: text("Sclère inférieure visible", "Lower scleral show"), kind: "score", priority: 70 },
      "eyelids_and_sclera.epicanthic_fold": { label: text("Pli épicanthique", "Epicanthic fold"), kind: "enum", priority: 80, valueLabels: commonEnumLabels },
      "under_eye_health.support_and_hollows": { label: text("Support sous les yeux", "Under-eye support"), kind: "score", priority: 90 },
      "under_eye_health.pigmentation": { label: text("Pigmentation sous les yeux", "Under-eye pigmentation"), kind: "score", priority: 100 },
      "details_and_color.sclera_clarity": { label: text("Clarté de la sclère", "Sclera clarity"), kind: "score", priority: 110 },
      "details_and_color.limbal_ring_visibility": { label: text("Anneau limbique", "Limbal ring visibility"), kind: "enum", priority: 120, valueLabels: commonEnumLabels },
      "details_and_color.eyelash_density": { label: text("Densité des cils", "Eyelash density"), kind: "score", priority: 130 },
      "details_and_color.iris_color": { label: text("Couleur de l’iris", "Iris color"), kind: "enum", priority: 140, valueLabels: commonEnumLabels },
    },
  },
  cheeks: {
    label: text("Joues", "Cheeks"),
    aggregates: {
      "zygomatic_placement.cheekbone_height_peak": { label: text("Hauteur des pommettes", "Cheekbone height peak"), kind: "score", priority: 10 },
      "zygomatic_placement.bizygomatic_width": { label: text("Largeur bizygomatique", "Bizygomatic width"), kind: "score", priority: 20 },
      "zygomatic_placement.cheek_to_eye_support": { label: text("Soutien joue-œil", "Cheek to eye support"), kind: "score", priority: 30 },
      "projection_and_contour.zygomatic_projection": { label: text("Projection des pommettes", "Zygomatic projection"), kind: "score", priority: 40 },
      "projection_and_contour.bone_definition": { label: text("Définition osseuse", "Bone definition"), kind: "score", priority: 50 },
      "projection_and_contour.ogee_curve": { label: text("Courbe en S du visage", "Ogee curve"), kind: "score", priority: 60 },
      "soft_tissue_and_hollowing.mid_cheek_fullness": { label: text("Volume du milieu des joues", "Mid-cheek fullness"), kind: "score", priority: 70 },
      "soft_tissue_and_hollowing.under_cheek_hollowing": { label: text("Creux sous les pommettes", "Under-cheek hollowing"), kind: "score", priority: 80 },
      "harmony_and_balance.cheek_to_jaw_balance": { label: text("Équilibre joues-mâchoire", "Cheek to jaw balance"), kind: "score", priority: 90 },
      "harmony_and_balance.cheek_symmetry": { label: text("Symétrie des joues", "Cheek symmetry"), kind: "score", priority: 100 },
      overall_cheek: { label: text("Score global des joues", "Overall cheek score"), kind: "score", priority: 110 },
    },
  },
  chin: {
    label: text("Menton", "Chin"),
    aggregates: {
      "shape_and_contour.chin_shape": { label: text("Forme du menton", "Chin shape"), kind: "enum", priority: 10 },
      "shape_and_contour.chin_contour": { label: text("Contour du menton", "Chin contour"), kind: "score", priority: 20 },
      "shape_and_contour.chin_fullness": { label: text("Volume du menton", "Chin fullness"), kind: "score", priority: 30 },
      "shape_and_contour.chin_dimple": { label: text("Fossette du menton", "Chin dimple"), kind: "enum", priority: 40 },
      "projection_and_profile.chin_projection": { label: text("Projection du menton", "Chin projection"), kind: "score", priority: 50 },
      "projection_and_profile.chin_inclination": { label: text("Inclinaison du menton", "Chin inclination"), kind: "score", priority: 60 },
      "projection_and_profile.chin_height": { label: text("Hauteur du menton", "Chin height"), kind: "score", priority: 70 },
      "width_and_balance.chin_width": { label: text("Largeur du menton", "Chin width"), kind: "score", priority: 80 },
      "width_and_balance.chin_to_jaw_harmony": { label: text("Harmonie menton-mâchoire", "Chin to jaw harmony"), kind: "score", priority: 90 },
      "width_and_balance.lower_face_balance": { label: text("Équilibre du bas du visage", "Lower face balance"), kind: "score", priority: 100 },
      overall_chin: { label: text("Score global du menton", "Overall chin score"), kind: "score", priority: 110 },
    },
  },
  coloring: {
    label: text("Ta colorimétrie globale", "Your global coloring"),
    aggregates: {
      "skin.tone": { label: text("Teint de peau", "Skin tone"), kind: "enum", priority: 10, valueLabels: commonEnumLabels },
      "skin.clarity": { label: text("Clarté de la peau", "Skin clarity"), kind: "score", priority: 20 },
      "skin.evenness": { label: text("Uniformité de la peau", "Skin evenness"), kind: "score", priority: 30 },
      "hair.color": { label: text("Couleur des cheveux", "Hair color"), kind: "enum", priority: 40, valueLabels: commonEnumLabels },
      "hair.depth": { label: text("Profondeur de couleur des cheveux", "Hair color depth"), kind: "score", priority: 50 },
      "hair.warmth": { label: text("Chaleur de couleur des cheveux", "Hair color warmth"), kind: "enum", priority: 60 },
      /** Iris detail lives on the dedicated eyes worker; coloring output only carries sclera clarity here. */
      "eyes.whites_clarity": { label: text("Clarté du blanc des yeux", "Eye whites clarity"), kind: "score", priority: 100 },
      "eyebrows.color": { label: text("Couleur des sourcils", "Eyebrow color"), kind: "enum", priority: 120, valueLabels: commonEnumLabels },
      "eyebrows.depth": { label: text("Profondeur de couleur des sourcils", "Eyebrow color depth"), kind: "score", priority: 130 },
      "eyebrows.contrast_vs_skin": { label: text("Contraste sourcils-peau", "Brows vs skin contrast"), kind: "score", priority: 140 },
      "lips.color": { label: text("Couleur des lèvres", "Lip color"), kind: "enum", priority: 150, valueLabels: commonEnumLabels },
      "lips.saturation": { label: text("Saturation des lèvres", "Lip saturation"), kind: "score", priority: 160 },
      "contrast.hair_vs_skin": { label: text("Contraste cheveux-peau", "Hair vs skin contrast"), kind: "score", priority: 170 },
      "contrast.eyes_vs_skin": { label: text("Contraste yeux-peau", "Eyes vs skin contrast"), kind: "score", priority: 180 },
      "contrast.brows_vs_skin": { label: text("Contraste sourcils-peau", "Brows vs skin contrast"), kind: "score", priority: 190 },
      "contrast.lips_vs_skin": { label: text("Contraste lèvres-peau", "Lips vs skin contrast"), kind: "score", priority: 200 },
      "contrast.overall_contrast": { label: text("Contraste global", "Overall contrast"), kind: "score", priority: 210 },
      "contrast.overall_contrast_score": {
        label: text("Contraste global", "Overall contrast"),
        kind: "score",
        priority: 210,
      },
      "contrast.contrast_type": { label: text("Type de contraste", "Contrast type"), kind: "enum", priority: 220, valueLabels: commonEnumLabels },
      global_coloring: { label: text("Colorimétrie globale", "Global coloring"), kind: "score", priority: 230 },
      global_coloring_score: {
        label: text("Colorimétrie globale", "Global coloring"),
        kind: "score",
        priority: 230,
      },
    },
  },
  neck: {
    label: text("Cou", "Neck"),
    aggregates: {
      "dimensions_and_proportions.neck_length": { label: text("Longueur du cou", "Neck length"), kind: "score", priority: 10 },
      "dimensions_and_proportions.neck_width": { label: text("Largeur du cou", "Neck width"), kind: "score", priority: 20 },
      "dimensions_and_proportions.neck_taper": { label: text("Affinement du cou", "Neck taper"), kind: "score", priority: 30 },
      "musculature_and_soft_tissue.muscle_definition": { label: text("Définition musculaire", "Muscle definition"), kind: "score", priority: 40 },
      "musculature_and_soft_tissue.submental_fat": { label: text("Graisse sous-mentonnière", "Submental fat"), kind: "score", priority: 50 },
      "musculature_and_soft_tissue.adams_apple_visibility": { label: text("Visibilité de la pomme d'Adam", "Adam's apple visibility"), kind: "enum", priority: 60, valueLabels: commonEnumLabels },
      "skin_firmness_and_texture.neck_firmness": { label: text("Fermeté du cou", "Neck firmness"), kind: "score", priority: 70 },
      "skin_firmness_and_texture.skin_texture": { label: text("Texture de la peau du cou", "Neck skin texture"), kind: "score", priority: 80 },
      "posture_and_alignment.neck_posture": { label: text("Posture du cou", "Neck posture"), kind: "score", priority: 90 },
      "posture_and_alignment.neck_shape": { label: text("Forme du cou", "Neck shape"), kind: "enum", priority: 100 },
      overall_neck: { label: text("Score global du cou", "Overall neck score"), kind: "score", priority: 110 },
    },
  },
  nose: {
    label: text("Nez", "Nose"),
    aggregates: {
      "frontal_symmetry_and_width.nose_symmetry": { label: text("Symétrie du nez", "Nose symmetry"), kind: "score", priority: 10 },
      "frontal_symmetry_and_width.overall_alar_width": { label: text("Largeur globale des ailes du nez", "Overall alar width"), kind: "score", priority: 20 },
      "frontal_symmetry_and_width.bridge_width": { label: text("Largeur de l'arête nasale", "Bridge width"), kind: "score", priority: 30 },
      "profile_dorsum_and_angles.bridge_shape": { label: text("Forme de l'arête nasale", "Bridge shape"), kind: "enum", priority: 40 },
      "profile_dorsum_and_angles.supratip_break": { label: text("Cassure supratip", "Supratip break"), kind: "score", priority: 50 },
      "profile_dorsum_and_angles.nasofrontal_angle": { label: text("Angle nasofrontal", "Nasofrontal angle"), kind: "score", priority: 60 },
      "profile_dorsum_and_angles.nasolabial_angle_rotation": { label: text("Angle nasolabial et rotation", "Nasolabial angle and rotation"), kind: "score", priority: 70 },
      "tip_morphology_and_projection.tip_definition": { label: text("Définition de la pointe", "Tip definition"), kind: "score", priority: 80 },
      "tip_morphology_and_projection.tip_projection": { label: text("Projection de la pointe", "Tip projection"), kind: "score", priority: 90 },
      "base_and_nostrils.nostril_shape": { label: text("Forme des narines", "Nostril shape"), kind: "enum", priority: 100 },
      "base_and_nostrils.columella_alignment": { label: text("Alignement de la columelle", "Columella alignment"), kind: "score", priority: 110 },
      "base_and_nostrils.nose_length": { label: text("Longueur du nez", "Nose length"), kind: "score", priority: 120 },
      overall_nose: { label: text("Score global du nez", "Overall nose score"), kind: "score", priority: 130 },
    },
  },
  skin: {
    label: text("Ton profil de peau", "Your skin profile"),
    aggregates: {
      "texture_and_pores.pore_size_visibility": { label: text("Visibilité des pores", "Pore visibility"), kind: "score", priority: 10 },
      "texture_and_pores.blackheads_and_congestion": { label: text("Points noirs et congestion", "Blackheads and congestion"), kind: "score", priority: 20 },
      "texture_and_pores.surface_smoothness": { label: text("Lissage de la surface cutanée", "Surface smoothness"), kind: "score", priority: 30 },
      "acne_and_scarring.active_acne": { label: text("Acné active", "Active acne"), kind: "score", priority: 40 },
      "acne_and_scarring.atrophic_scarring": { label: text("Cicatrices atrophiques", "Atrophic scarring"), kind: "score", priority: 50 },
      "pigmentation_and_tone.color_uniformity": { label: text("Uniformité du teint", "Color uniformity"), kind: "score", priority: 60 },
      "pigmentation_and_tone.redness_and_erythema": { label: text("Rougeurs et érythème", "Redness and erythema"), kind: "score", priority: 70 },
      "hydration_and_vitality.sebum_hydration_balance": { label: text("Équilibre sébum-hydratation", "Sebum hydration balance"), kind: "score", priority: 80 },
      "hydration_and_vitality.firmness_and_elasticity": { label: text("Fermeté et élasticité", "Firmness and elasticity"), kind: "score", priority: 90 },
      overall_skin: { label: text("Score global de la peau", "Overall skin score"), kind: "score", priority: 100 },
    },
  },
  smile: {
    label: text("Sourire", "Smile"),
    aggregates: {
      "dental_quality.shade_and_whiteness": { label: text("Teinte et blancheur des dents", "Tooth shade and whiteness"), kind: "score", priority: 10 },
      "dental_quality.surface_integrity": { label: text("Intégrité de la surface dentaire", "Surface integrity"), kind: "score", priority: 20 },
      "dental_quality.tooth_proportions": { label: text("Proportions dentaires", "Tooth proportions"), kind: "score", priority: 30 },
      "smile_architecture.alignment": { label: text("Alignement dentaire", "Dental alignment"), kind: "score", priority: 40 },
      "smile_architecture.midline_alignment": { label: text("Alignement de la ligne médiane", "Midline alignment"), kind: "score", priority: 50 },
      "smile_architecture.smile_arc": { label: text("Arc du sourire", "Smile arc"), kind: "score", priority: 60 },
      "smile_dynamics.smile_symmetry": { label: text("Symétrie du sourire", "Smile symmetry"), kind: "score", priority: 70 },
      "smile_dynamics.buccal_corridors": { label: text("Corridors buccaux", "Buccal corridors"), kind: "score", priority: 80 },
      "smile_dynamics.teeth_visibility_count": { label: text("Nombre de dents visibles", "Visible teeth count"), kind: "score", priority: 90 },
      "smile_dynamics.gingival_display": { label: text("Exposition gingivale", "Gingival display"), kind: "score", priority: 100 },
      "smile_dynamics.upper_lip_curvature": { label: text("Courbure de la lèvre supérieure", "Upper lip curvature"), kind: "score", priority: 110 },
      "facial_impact.duchenne_activation": { label: text("Activation de Duchenne", "Duchenne activation"), kind: "enum", priority: 120, valueLabels: commonEnumLabels },
      "facial_impact.cheek_dimples": { label: text("Fossettes des joues", "Cheek dimples"), kind: "score", priority: 130 },
      overall_smile: { label: text("Score global du sourire", "Overall smile score"), kind: "score", priority: 140 },
    },
  },
  skin_tint: {
    label: text("Teint", "Skin tone"),
    aggregates: {
      "phenotype_and_undertone.fitzpatrick_type": { label: text("Type de peau Fitzpatrick", "Fitzpatrick skin type"), kind: "enum", priority: 10 },
      "phenotype_and_undertone.skin_undertone": { label: text("Sous-ton du teint", "Skin undertone"), kind: "enum", priority: 20 },
      "vitality_and_radiance.color_radiance_glow": { label: text("Éclat et luminosité du teint", "Skin radiance and glow"), kind: "score", priority: 30 },
      "vitality_and_radiance.sallowness_absence": { label: text("Absence de teint terne", "Absence of sallowness"), kind: "score", priority: 40 },
      "pigment_distribution.melanin_uniformity": { label: text("Uniformité de la mélanine", "Melanin uniformity"), kind: "score", priority: 50 },
      "pigment_distribution.periorbital_perioral_match": { label: text("Cohérence contour des yeux / contour de la bouche", "Periorbital / perioral match"), kind: "score", priority: 60 },
      "sun_exposure_aesthetic.uv_exposure_aesthetic": { label: text("Marques esthétiques d'exposition solaire", "Aesthetic UV exposure marks"), kind: "score", priority: 70 },
      overall_colorimetry_score: { label: text("Score global de colorimétrie", "Overall colorimetry score"), kind: "score", priority: 80 },
      overall_colorimetry: { label: text("Score global de colorimétrie", "Overall colorimetry score"), kind: "score", priority: 80 },
    },
  },
  ear: {
    label: text("Oreilles", "Ears"),
    aggregates: {
      "proportions_and_placement.size_harmony": { label: text("Harmonie de taille des oreilles", "Ear size harmony"), kind: "score", priority: 10 },
      "proportions_and_placement.vertical_placement": { label: text("Placement vertical des oreilles", "Vertical ear placement"), kind: "score", priority: 20 },
      "proportions_and_placement.axis_tilt": { label: text("Inclinaison de l'axe des oreilles", "Ear axis tilt"), kind: "score", priority: 30 },
      "projection_and_frontal.ear_projection": { label: text("Projection des oreilles", "Ear projection"), kind: "score", priority: 40 },
      "projection_and_frontal.cartilage_architecture": { label: text("Structure du cartilage", "Cartilage architecture"), kind: "score", priority: 50 },
      "morphology.ear_symmetry": { label: text("Symétrie des oreilles", "Ear symmetry"), kind: "score", priority: 60 },
      "morphology.helix_contour": { label: text("Contour de l'hélix", "Helix contour"), kind: "enum", priority: 70, valueLabels: commonEnumLabels },
      "morphology.earlobe_shape": { label: text("Forme du lobe", "Earlobe shape"), kind: "enum", priority: 80, valueLabels: commonEnumLabels },
      overall_ear: { label: text("Score global des oreilles", "Overall ear score"), kind: "score", priority: 90 },
    },
  },
  eye_brows: {
    label: text("Sourcils", "Eyebrows"),
    aggregates: {
      "placement_and_spacing.elevation_brow_to_eye": { label: text("Hauteur sourcil-œil", "Brow-to-eye elevation"), kind: "score", priority: 10 },
      "placement_and_spacing.inter_brow_distance": { label: text("Distance entre les sourcils", "Inter-brow distance"), kind: "score", priority: 20 },
      "placement_and_spacing.eyebrow_symmetry": { label: text("Symétrie des sourcils", "Eyebrow symmetry"), kind: "score", priority: 30 },
      "geometry_and_tilt.eyebrow_tilt": { label: text("Inclinaison des sourcils", "Eyebrow tilt"), kind: "enum", priority: 40, valueLabels: commonEnumLabels },
      "geometry_and_tilt.eyebrow_shape": { label: text("Forme des sourcils", "Eyebrow shape"), kind: "enum", priority: 50, valueLabels: commonEnumLabels },
      "geometry_and_tilt.tail_length": { label: text("Longueur de la queue du sourcil", "Eyebrow tail length"), kind: "score", priority: 60 },
      "geometry_and_tilt.inner_start_shape": { label: text("Forme du départ du sourcil", "Inner brow start shape"), kind: "enum", priority: 70, valueLabels: commonEnumLabels },
      "thickness_and_density.eyebrow_thickness": { label: text("Épaisseur des sourcils", "Eyebrow thickness"), kind: "score", priority: 80 },
      "thickness_and_density.eyebrow_density": { label: text("Densité des sourcils", "Eyebrow density"), kind: "score", priority: 90 },
      "thickness_and_density.eyelash_density": { label: text("Densité des cils", "Eyelash density"), kind: "score", priority: 100 },
      "thickness_and_density.hair_color": { label: text("Couleur des poils", "Hair color"), kind: "enum", priority: 110, valueLabels: commonEnumLabels },
      overall_brow: { label: text("Score global des sourcils", "Overall brow score"), kind: "score", priority: 120 },
    },
  },
  hair: {
    label: text("Cheveux", "Hair"),
    aggregates: {
      "hair_quality.density": { label: text("Densité capillaire", "Hair density"), kind: "score", priority: 10 },
      "hair_quality.strand_thickness": { label: text("Épaisseur des cheveux", "Strand thickness"), kind: "score", priority: 20 },
      "hair_quality.shine": { label: text("Brillance", "Shine"), kind: "score", priority: 30 },
      "hair_quality.health_appearance": { label: text("Apparence de santé capillaire", "Hair health appearance"), kind: "score", priority: 40 },
      "hair_quality.uniformity": { label: text("Uniformité capillaire", "Hair uniformity"), kind: "score", priority: 50 },
      "hair_characteristics.texture_type": { label: text("Type de texture", "Texture type"), kind: "enum", priority: 60, valueLabels: commonEnumLabels },
      "hair_characteristics.curl_definition": { label: text("Définition des boucles", "Curl definition"), kind: "score", priority: 70 },
      "hair_characteristics.length_category": { label: text("Catégorie de longueur", "Length category"), kind: "enum", priority: 80, valueLabels: commonEnumLabels },
      "hairline.shape": { label: text("Forme de la ligne capillaire", "Hairline shape"), kind: "enum", priority: 90 },
      "hairline.symmetry": { label: text("Symétrie de la ligne capillaire", "Hairline symmetry"), kind: "score", priority: 100 },
      "hairline.density": { label: text("Densité de la ligne capillaire", "Hairline density"), kind: "score", priority: 110 },
      "hairline.recession_level": { label: text("Niveau de recul capillaire", "Hairline recession level"), kind: "score", priority: 120 },
      overall_hair: { label: text("Score global des cheveux", "Overall hair score"), kind: "score", priority: 130 },
    },
  },
  jaw: {
    label: text("Mâchoire", "Jaw"),
    aggregates: {
      "frontal_geometry.jaw_shape_frontal": { label: text("Forme frontale de la mâchoire", "Frontal jaw shape"), kind: "enum", priority: 10 },
      "frontal_geometry.jaw_width": { label: text("Largeur de la mâchoire", "Jaw width"), kind: "score", priority: 20 },
      "frontal_geometry.jaw_to_cheek_ratio": { label: text("Ratio mâchoire-joues", "Jaw to cheek ratio"), kind: "score", priority: 30 },
      "frontal_geometry.jaw_to_face_proportion": { label: text("Proportion mâchoire-visage", "Jaw to face proportion"), kind: "score", priority: 40 },
      "profile_architecture.jaw_shape_side": { label: text("Forme de profil de la mâchoire", "Side jaw shape"), kind: "enum", priority: 50 },
      "profile_architecture.jaw_height_ramus": { label: text("Hauteur du ramus mandibulaire", "Ramus height"), kind: "score", priority: 60 },
      "profile_architecture.jawline_length": { label: text("Longueur de la ligne mandibulaire", "Jawline length"), kind: "score", priority: 70 },
      "definition_and_contrast.jawline_definition": { label: text("Définition de la mâchoire", "Jawline definition"), kind: "score", priority: 80 },
      "definition_and_contrast.jawline_contrast_neck": { label: text("Contraste mâchoire-cou", "Jawline contrast with neck"), kind: "score", priority: 90 },
      "symmetry_and_flare.jaw_symmetry": { label: text("Symétrie de la mâchoire", "Jaw symmetry"), kind: "score", priority: 100 },
      "symmetry_and_flare.jaw_flare_symmetry": { label: text("Symétrie de l'évasement mandibulaire", "Jaw flare symmetry"), kind: "score", priority: 110 },
      overall_jaw: { label: text("Score global de la mâchoire", "Overall jaw score"), kind: "score", priority: 120 },
    },
  },
  lips: {
    label: text("Lèvres", "Lips"),
    aggregates: {
      "proportions_and_width.lip_fullness": { label: text("Volume des lèvres", "Lip fullness"), kind: "score", priority: 10 },
      "proportions_and_width.upper_lower_ratio": { label: text("Ratio lèvre supérieure / inférieure", "Upper / lower lip ratio"), kind: "score", priority: 20 },
      "proportions_and_width.lip_width": { label: text("Largeur des lèvres", "Lip width"), kind: "score", priority: 30 },
      "upper_lip_architecture.philtrum_length": { label: text("Longueur du philtrum", "Philtrum length"), kind: "score", priority: 40 },
      "upper_lip_architecture.cupids_bow_definition": { label: text("Définition de l'arc de Cupidon", "Cupid's bow definition"), kind: "score", priority: 50 },
      "upper_lip_architecture.vermilion_border": { label: text("Délimitation du vermillon", "Vermilion border"), kind: "score", priority: 60 },
      "projection_and_dynamics.lip_projection": { label: text("Projection des lèvres", "Lip projection"), kind: "score", priority: 70 },
      "projection_and_dynamics.commissure_tilt": { label: text("Inclinaison des commissures", "Commissure tilt"), kind: "score", priority: 80 },
      "texture_and_color.smoothness_hydration": { label: text("Lissage et hydratation", "Smoothness and hydration"), kind: "score", priority: 90 },
      "texture_and_color.perioral_youthfulness": { label: text("Jeunesse du contour de la bouche", "Perioral youthfulness"), kind: "score", priority: 100 },
      "texture_and_color.color_contrast": { label: text("Contraste de couleur", "Color contrast"), kind: "score", priority: 110 },
      "lip_color_phenotype.exact_lip_color": { label: text("Couleur exacte des lèvres", "Exact lip color"), kind: "enum", priority: 120 },
      overall_lip_score: { label: text("Score global des lèvres", "Overall lip score"), kind: "score", priority: 130 },
      overall_lip: { label: text("Score global des lèvres", "Overall lip score"), kind: "score", priority: 130 },
      "texture_and_color.exact_lip_color": { label: text("Couleur exacte des lèvres", "Exact lip color"), kind: "enum", priority: 140 },
    },
  },
};

function sentenceCase(value: string): string {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : value;
}

function stripDisplaySuffix(key: string): string {
  return key.replace(/\.(score|argument)$/i, "");
}

const fallbackSegmentLabels: Record<FaceAnalysisLocale, Record<string, string>> = {
  fr: {
    absence: "absence",
    aesthetic: "esthétique",
    angularity: "angularité",
    architecture: "architecture",
    athletic: "athlétique",
    border: "bordure",
    buccal: "joues",
    bow: "arc",
    color: "couleur",
    colorimetry: "colorimétrie",
    commissure: "commissure",
    contrast: "contraste",
    cupids: "Cupidon",
    definition: "définition",
    distribution: "répartition",
    dynamics: "dynamique",
    exact: "exacte",
    exposure: "exposition",
    facial: "faciale",
    fat: "gras",
    fitzpatrick: "Fitzpatrick",
    fullness: "volume",
    glow: "luminosité",
    hydration: "hydratation",
    jawline: "mâchoire",
    lean: "mince",
    leanness: "minceur",
    lip: "lèvre",
    lips: "lèvres",
    match: "cohérence",
    melanin: "mélanine",
    midface: "milieu du visage",
    neck: "cou",
    perioral: "contour de la bouche",
    periorbital: "contour des yeux",
    phenotype: "phénotype",
    philtrum: "philtrum",
    pigment: "pigment",
    projection: "projection",
    proportions: "proportions",
    radiance: "éclat",
    ratio: "ratio",
    sallowness: "teint terne",
    skin: "peau",
    submental: "sous le menton",
    smoothness: "lissage",
    sun: "soleil",
    texture: "texture",
    tilt: "inclinaison",
    tier: "niveau",
    tightness: "tension",
    tone: "teint",
    undertone: "sous-ton",
    uniformity: "uniformité",
    upper: "supérieure",
    uv: "UV",
    vermilion: "vermillon",
    visibility: "visibilité",
    visual: "visuel",
    vitality: "vitalité",
    width: "largeur",
    youthfulness: "jeunesse",
  },
  en: {},
};

function fallbackLabel(key: string, locale: FaceAnalysisLocale = DEFAULT_FACE_ANALYSIS_LOCALE): string {
  const displayKey = stripDisplaySuffix(key);
  const lastSegment = displayKey.split(".").filter(Boolean).pop() ?? displayKey;
  const normalizedSegments = lastSegment
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split("_")
    .filter(Boolean);

  if (
    locale === "fr" &&
    normalizedSegments.includes("periorbital") &&
    normalizedSegments.includes("perioral") &&
    normalizedSegments.includes("match")
  ) {
    return "Cohérence contour des yeux / contour de la bouche";
  }

  const segmentLabels = fallbackSegmentLabels[locale];
  const translated = normalizedSegments.map((segment) => segmentLabels[segment] ?? segment);

  return sentenceCase(translated.join(" "));
}

function normalizeEnumKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function formatUnknownValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "Non renseigné";
  }

  if (typeof value === "number") {
    return formatNumber(value);
  }

  if (typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }

  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(formatUnknownValue).join(", ");
  }

  if (typeof value === "object") {
    return `${Object.keys(value).length} champ${Object.keys(value).length > 1 ? "s" : ""}`;
  }

  return String(value);
}

export function getWorkerDisplayLabel(
  worker: string,
  locale: FaceAnalysisLocale = DEFAULT_FACE_ANALYSIS_LOCALE,
): string {
  return resolveLocalizedText(displayMeta[worker]?.label, locale)
    ?? resolveLocalizedText(workerLabels[worker], locale)
    ?? fallbackLabel(worker, locale);
}

export function getAggregateDisplayMeta(worker: string, key: string): AggregateDisplayMeta | undefined {
  return displayMeta[worker]?.aggregates?.[key] ?? displayMeta[worker]?.aggregates?.[stripDisplaySuffix(key)];
}

export function formatAggregateDisplayLabel(
  worker: string,
  key: string,
  locale: FaceAnalysisLocale = DEFAULT_FACE_ANALYSIS_LOCALE,
): string {
  return resolveLocalizedText(getAggregateDisplayMeta(worker, key)?.label, locale) ?? fallbackLabel(key, locale);
}

export function formatAggregateDisplayValue(
  worker: string,
  key: string,
  value: unknown,
  locale: FaceAnalysisLocale = DEFAULT_FACE_ANALYSIS_LOCALE,
): string {
  const meta = getAggregateDisplayMeta(worker, key);

  if (value === null || value === undefined) {
    return "Non renseigné";
  }

  if (meta?.kind === "enum" && typeof value === "string") {
    const enumKey = normalizeEnumKey(value);
    return resolveLocalizedText(meta.valueLabels?.[enumKey], locale)
      ?? resolveLocalizedText(commonEnumLabels[enumKey], locale)
      ?? sentenceCase(value.replace(/_/g, " "));
  }

  if (meta?.kind === "score") {
    const score = parseNumber(value);
    return score === null ? formatUnknownValue(value) : formatNumber(score);
  }

  if (meta?.kind === "boolean" && typeof value === "boolean") {
    return value ? "Oui" : "Non";
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatAggregateDisplayValue(worker, key, item, locale)).join(", ");
  }

  return formatUnknownValue(value);
}

export function getAggregateDisplayDescription(
  worker: string,
  key: string,
  value: unknown,
  locale: FaceAnalysisLocale = DEFAULT_FACE_ANALYSIS_LOCALE,
): string | null {
  const meta = getAggregateDisplayMeta(worker, key);
  const description = resolveLocalizedText(meta?.description, locale);
  if (description) {
    return description;
  }

  if (meta?.kind !== "score") {
    return null;
  }

  const score = parseNumber(value);
  if (score === null) {
    return null;
  }

  if (score >= 8) {
    return "Signal très favorable.";
  }
  if (score >= 6) {
    return "Signal globalement favorable.";
  }
  if (score >= 4) {
    return "Signal modéré.";
  }
  return "Signal plus faible à surveiller.";
}

function isArgumentKey(key: string): boolean {
  return /\.argument$/i.test(key);
}

function isScoreKey(key: string): boolean {
  return /\.score$/i.test(key);
}

function buildAggregatePriority(worker: string, key: string): number {
  return getAggregateDisplayMeta(worker, key)?.priority ?? Number.MAX_SAFE_INTEGER;
}

export function buildAggregateDisplayEntries(
  worker: string,
  aggregates: Record<string, unknown>,
  locale: FaceAnalysisLocale = DEFAULT_FACE_ANALYSIS_LOCALE,
): AggregateDisplayEntry[] {
  const entriesByKey = new Map<string, AggregateDisplayEntry>();

  for (const [key, value] of Object.entries(aggregates)) {
    if (isArgumentKey(key)) {
      continue;
    }

    const baseKey = stripDisplaySuffix(key);
    const argumentValue = aggregates[`${baseKey}.argument`];
    const scoreValue = isScoreKey(key) ? value : aggregates[`${baseKey}.score`];
    const displayValue = scoreValue === undefined ? value : scoreValue;
    const description = getAggregateDisplayDescription(worker, baseKey, displayValue, locale);
    const argument = typeof argumentValue === "string" && argumentValue.trim()
      ? argumentValue
      : null;

    entriesByKey.set(baseKey, {
      key: baseKey,
      label: formatAggregateDisplayLabel(worker, baseKey, locale),
      value: formatAggregateDisplayValue(worker, baseKey, displayValue, locale),
      argument,
      description: argument ?? description,
    });
  }

  return Array.from(entriesByKey.values())
    .filter((entry) => !getAggregateDisplayMeta(worker, entry.key)?.hidden)
    .sort((entryA, entryB) => {
      const priorityA = buildAggregatePriority(worker, entryA.key);
      const priorityB = buildAggregatePriority(worker, entryB.key);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return entryA.key.localeCompare(entryB.key, "fr");
    });
}

export type WorkerAggregateCatalogEntry = {
  key: string;
  label: string;
  kind: AggregateDisplayKind | null;
  priority: number;
  hidden: boolean;
  enumValues: { value: string; label: string }[] | null;
};

/**
 * Lists every documented aggregate for a worker. Used by the admin
 * recommendations editor so authors can see what they can write rules against
 * without opening source code.
 */
export function listWorkerAggregateCatalog(
  worker: string,
  locale: FaceAnalysisLocale = DEFAULT_FACE_ANALYSIS_LOCALE,
): WorkerAggregateCatalogEntry[] {
  const meta = displayMeta[worker]?.aggregates ?? {};
  return Object.entries(meta)
    .map(([key, value]) => {
      const enumValues = value.kind === "enum" && value.valueLabels
        ? Object.entries(value.valueLabels).map(([enumKey, enumLabel]) => ({
            value: enumKey,
            label: resolveLocalizedText(enumLabel, locale) ?? enumKey,
          }))
        : null;
      return {
        key,
        label: resolveLocalizedText(value.label, locale) ?? key,
        kind: value.kind ?? null,
        priority: value.priority,
        hidden: value.hidden ?? false,
        enumValues,
      };
    })
    .sort((a, b) => a.priority - b.priority);
}

/** Returns all known worker codes (in display order). */
export function listKnownWorkers(): string[] {
  return Object.keys(displayMeta);
}

export function sortAggregateEntries(worker: string, entries: Array<[string, unknown]>): Array<[string, unknown]> {
  return [...entries]
    .filter(([key]) => !isArgumentKey(key) && !getAggregateDisplayMeta(worker, key)?.hidden)
    .sort(([keyA], [keyB]) => {
      const priorityA = buildAggregatePriority(worker, keyA);
      const priorityB = buildAggregatePriority(worker, keyB);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      return keyA.localeCompare(keyB, "fr");
    });
}
