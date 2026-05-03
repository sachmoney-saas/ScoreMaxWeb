-- ============================================================================
-- ScoreMax — Recommendations seed for the EYES worker
--
-- Each row = one recommendation. UPSERT on id so re-running this script
-- updates content in place without breaking foreign keys to user actions.
--
-- Conditions DSL (stored in `conditions` JSONB):
--   { "all": true }                                    → always relevant
--   { "score_lte": { "key": "...", "value": N } }     → fires when score <= N
--   { "score_gte": { "key": "...", "value": N } }     → fires when score >= N
--   { "enum_in":   { "key": "...", "values": [...] } }→ fires when enum matches
--   { "and": [ ... ] } / { "or": [ ... ] }            → composition
--
-- Targets: list of aggregate keys this rec aims to improve. Used both for
-- explanation copy ("why for you") and for relevance ranking.
-- ============================================================================

-- Helper inline note: amounts are EUR ranges based on European average pricing
-- as of 2026; cosmetic only, not medical advice.

WITH recs AS (
  SELECT * FROM (VALUES
    -- ====================== SOFTMAXXING (15) =================================
    (
      'eyes.sleep_optimization', 'eyes', 'soft', 'habit', 80,
      'Sleep & recovery routine',
      'Routine de sommeil et récupération',
      'Consistent 7–9h sleep with elevated head reduces fluid retention, fades dark circles, and gives the periocular tissue time to regenerate collagen and lymphatic clearance.',
      'Un sommeil régulier de 7 à 9 h, tête légèrement surélevée, réduit la rétention d''eau, atténue les cernes et laisse aux tissus péri-oculaires le temps de régénérer collagène et drainage lymphatique.',
      jsonb_build_array(
        jsonb_build_object('en', 'Sleep 7–9h at consistent times (within 30 min window).',           'fr', 'Dors 7 à 9 h à heures régulières (fenêtre de 30 min).'),
        jsonb_build_object('en', 'Use a slightly elevated pillow to reduce overnight fluid pooling.', 'fr', 'Surélève légèrement l''oreiller pour réduire la rétention nocturne.'),
        jsonb_build_object('en', 'Cut blue light 60 min before bed; it suppresses melatonin and skin repair.', 'fr', 'Coupe la lumière bleue 60 min avant le coucher : elle bloque mélatonine et réparation cutanée.'),
        jsonb_build_object('en', 'Sleep on your back; side/stomach sleeping deepens creases.',         'fr', 'Dors sur le dos ; le ventre/côté creuse les plis.')
      ),
      4, 'weeks', 0, 0, 'EUR', 'none', 'studies',
      ARRAY['under_eye_health.support_and_hollows','under_eye_health.pigmentation','details_and_color.sclera_clarity'],
      jsonb_build_object('or', jsonb_build_array(
        jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.support_and_hollows','value',7)),
        jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.pigmentation','value',7))
      ))
    ),
    (
      'eyes.eye_nutrition', 'eyes', 'soft', 'nutrition', 70,
      'Eye-targeted nutrition',
      'Nutrition ciblée pour les yeux',
      'Vitamins C/E, zinc, omega-3, beta-carotene and quality protein protect collagen and elastin in the periocular skin and stabilise the tear film.',
      'Vitamines C/E, zinc, oméga-3, bêta-carotène et protéines de qualité protègent le collagène et l''élastine de la peau péri-oculaire et stabilisent le film lacrymal.',
      jsonb_build_array(
        jsonb_build_object('en', 'Hit ≥ 2L water/day to maintain dermal turgor.',         'fr', 'Vise ≥ 2 L d''eau/jour pour le tonus cutané.'),
        jsonb_build_object('en', 'Daily: leafy greens, eggs, oily fish or omega-3 supplement.', 'fr', 'Au quotidien : légumes verts, œufs, poisson gras ou complément oméga-3.'),
        jsonb_build_object('en', 'Add 500 mg vitamin C + zinc 15 mg if not in your diet.',  'fr', 'Ajoute 500 mg vitamine C + 15 mg zinc si absents de l''alimentation.')
      ),
      8, 'weeks', 10, 40, 'EUR', 'none', 'studies',
      ARRAY['details_and_color.sclera_clarity','under_eye_health.pigmentation'],
      jsonb_build_object('all', true)
    ),
    (
      'eyes.sun_protection', 'eyes', 'soft', 'topical', 75,
      'Daily SPF + UV-blocking sunglasses',
      'SPF quotidien + lunettes anti-UV',
      'UV exposure breaks down collagen, deepens infraorbital pigmentation and accelerates eye-area aging. Layered protection (SPF + lenses) is the highest-leverage soft intervention.',
      'L''exposition UV dégrade le collagène, accentue la pigmentation infraorbitaire et accélère le vieillissement du contour des yeux. Une protection en couches (SPF + verres) est l''intervention soft la plus rentable.',
      jsonb_build_array(
        jsonb_build_object('en', 'Apply SPF 30–50 to the eye contour every morning.',  'fr', 'Applique un SPF 30–50 sur le contour des yeux chaque matin.'),
        jsonb_build_object('en', 'Wear UVA/UVB sunglasses outdoors year-round.',        'fr', 'Porte des lunettes UVA/UVB en extérieur toute l''année.'),
        jsonb_build_object('en', 'Avoid peak sun (11h–15h) when possible.',             'fr', 'Évite le soleil entre 11 h et 15 h quand possible.')
      ),
      12, 'weeks', 30, 80, 'EUR', 'none', 'medical',
      ARRAY['under_eye_health.pigmentation','details_and_color.sclera_clarity'],
      jsonb_build_object('all', true)
    ),
    (
      'eyes.cold_therapy', 'eyes', 'soft', 'device', 70,
      'Cold therapy (jade roller / spoons)',
      'Thérapie par le froid (jade roller, cuillères)',
      'Cold vasoconstricts capillaries, reduces puffiness and tightens skin around the orbital rim. Cheap, immediate visible effect and zero risk.',
      'Le froid vasoconstricte les capillaires, réduit les poches et tonifie la peau autour de l''orbite. Peu cher, effet visible immédiat, aucun risque.',
      jsonb_build_array(
        jsonb_build_object('en', 'Chill 2 spoons or a jade roller overnight.',                  'fr', 'Mets 2 cuillères ou un jade roller au congélateur la veille.'),
        jsonb_build_object('en', 'Apply 30s under each eye morning and evening.',               'fr', 'Applique 30 s sous chaque œil matin et soir.'),
        jsonb_build_object('en', 'Roll inner → outer corner to follow lymphatic drainage.',     'fr', 'Roule du coin interne vers l''externe pour suivre le drainage lymphatique.')
      ),
      4, 'weeks', 0, 25, 'EUR', 'none', 'community',
      ARRAY['under_eye_health.support_and_hollows','under_eye_health.pigmentation'],
      jsonb_build_object('or', jsonb_build_array(
        jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.support_and_hollows','value',6)),
        jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.pigmentation','value',6))
      ))
    ),
    (
      'eyes.orbicularis_exercise', 'eyes', 'soft', 'exercise', 60,
      'Orbicularis oculi training',
      'Entraînement de l''orbiculaire',
      'Toning the orbicularis oculi prevents lower-lid sag, reduces creasing and supports lid closure dynamics.',
      'Tonifier l''orbiculaire prévient le relâchement de la paupière inférieure, réduit les plis et soutient la fermeture des paupières.',
      jsonb_build_array(
        jsonb_build_object('en', 'Gently squeeze your eyes shut for 10s × 4 reps.',         'fr', 'Ferme doucement les yeux 10 s × 4 répétitions.'),
        jsonb_build_object('en', 'Repeat 3 times per day, every day.',                       'fr', 'Répète 3 fois par jour, tous les jours.'),
        jsonb_build_object('en', 'Train both eyes equally to preserve symmetry.',            'fr', 'Travaille les deux yeux de façon égale pour la symétrie.')
      ),
      8, 'weeks', 0, 0, 'EUR', 'none', 'community',
      ARRAY['eyelids_and_sclera.upper_eyelid_exposure','morphology_and_tilt.eye_symmetry'],
      jsonb_build_object('or', jsonb_build_array(
        jsonb_build_object('score_lte', jsonb_build_object('key','eyelids_and_sclera.upper_eyelid_exposure','value',6)),
        jsonb_build_object('score_lte', jsonb_build_object('key','morphology_and_tilt.eye_symmetry','value',7))
      ))
    ),
    (
      'eyes.lateral_lifting_massage', 'eyes', 'soft', 'exercise', 65,
      'Lateral lifting massage',
      'Massage de lifting latéral',
      'Inner-to-outer corner massage strengthens the lateral halo and supports a positive canthal tilt over time.',
      'Un massage du coin interne vers l''externe renforce le halo latéral et soutient un canthal tilt positif dans le temps.',
      jsonb_build_array(
        jsonb_build_object('en', 'Use clean fingertips, light pressure.',                                'fr', 'Bouts des doigts propres, pression légère.'),
        jsonb_build_object('en', 'Stroke from inner canthus to outer corner, 10× per side, daily.',      'fr', 'Effleure du canthus interne vers l''externe, 10× par côté, chaque jour.'),
        jsonb_build_object('en', 'Always combine with a serum or oil to avoid skin friction.',           'fr', 'Toujours avec un sérum ou une huile pour éviter la friction.')
      ),
      12, 'weeks', 0, 30, 'EUR', 'low', 'community',
      ARRAY['morphology_and_tilt.canthal_tilt','morphology_and_tilt.eye_symmetry'],
      jsonb_build_object('enum_in', jsonb_build_object('key','morphology_and_tilt.canthal_tilt','values', jsonb_build_array('negative','neutral','downturned','downward')))
    ),
    (
      'eyes.topical_antioxidants', 'eyes', 'soft', 'topical', 70,
      'Vitamin C + niacinamide eye serum',
      'Sérum yeux vitamine C + niacinamide',
      'Topical vitamin C neutralises free radicals, evens out infraorbital pigmentation and supports dermal collagen. Niacinamide reinforces the barrier.',
      'La vitamine C topique neutralise les radicaux libres, uniformise la pigmentation infraorbitaire et soutient le collagène. La niacinamide renforce la barrière.',
      jsonb_build_array(
        jsonb_build_object('en', 'Apply a pea-sized amount AM after cleansing, before SPF.',  'fr', 'Une petite goutte le matin après nettoyage, avant le SPF.'),
        jsonb_build_object('en', 'Pat — never rub — into the orbital rim and tear-trough.',    'fr', 'Tapote — sans frotter — sur le rebord orbitaire et la vallée des larmes.'),
        jsonb_build_object('en', 'Allow 8–12 weeks before assessing results.',                 'fr', 'Compte 8 à 12 semaines avant d''évaluer.')
      ),
      10, 'weeks', 25, 80, 'EUR', 'low', 'studies',
      ARRAY['under_eye_health.pigmentation','details_and_color.sclera_clarity'],
      jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.pigmentation','value',6))
    ),
    (
      'eyes.peptide_hyaluronic_cream', 'eyes', 'soft', 'topical', 65,
      'Peptide + hyaluronic acid eye cream',
      'Crème yeux peptides + acide hyaluronique',
      'Peptides signal collagen synthesis; hyaluronic acid restores hydration and short-term plumping under the eye.',
      'Les peptides stimulent la synthèse de collagène ; l''acide hyaluronique restaure l''hydratation et donne un effet repulpé immédiat.',
      jsonb_build_array(
        jsonb_build_object('en', 'Apply PM after cleansing.',                              'fr', 'Applique le soir après nettoyage.'),
        jsonb_build_object('en', 'Layer under a richer cream during winter.',              'fr', 'Couche sous une crème plus riche en hiver.')
      ),
      10, 'weeks', 30, 90, 'EUR', 'low', 'studies',
      ARRAY['under_eye_health.support_and_hollows','under_eye_health.pigmentation'],
      jsonb_build_object('all', true)
    ),
    (
      'eyes.icehooding', 'eyes', 'soft', 'habit', 50,
      'Ice-hooding',
      'Ice-hooding',
      'Cold water exposure (<7 °C) on the eye region is anecdotally reported to stimulate periorbital fat and increase upper-lid hooding over time.',
      'L''exposition à l''eau froide (<7 °C) sur la zone des yeux serait associée à une stimulation du gras péri-orbitaire et à un effet « hooded » accru.',
      jsonb_build_array(
        jsonb_build_object('en', 'Submerge face in ice-cold water for 20–30s, 1×/day.',  'fr', 'Plonge le visage dans l''eau glacée 20 à 30 s, 1×/jour.'),
        jsonb_build_object('en', 'Pat dry, apply moisturiser and SPF.',                  'fr', 'Tamponne, applique hydratation et SPF.'),
        jsonb_build_object('en', 'Skip if you have rosacea, broken capillaries or cardiac issues.', 'fr', 'À éviter en cas de rosacée, capillaires fragiles ou problèmes cardiaques.')
      ),
      12, 'weeks', 0, 0, 'EUR', 'low', 'community',
      ARRAY['eyelids_and_sclera.upper_eyelid_exposure'],
      jsonb_build_object('score_gte', jsonb_build_object('key','eyelids_and_sclera.upper_eyelid_exposure','value',7))
    ),
    (
      'eyes.eyelash_growth_natural', 'eyes', 'soft', 'topical', 55,
      'Castor oil eyelash care',
      'Soin des cils à l''huile de ricin',
      'Castor oil conditions and supports lash retention. Cheap, low risk, slow but visible improvement over months.',
      'L''huile de ricin nourrit et soutient la rétention des cils. Peu cher, faible risque, amélioration lente mais visible sur plusieurs mois.',
      jsonb_build_array(
        jsonb_build_object('en', 'Apply 1 drop to a clean lash brush, sweep along the lash line at night.', 'fr', 'Une goutte sur une brosse propre, applique le long des cils le soir.'),
        jsonb_build_object('en', 'Avoid contact with the eye itself.',                                        'fr', 'Évite tout contact avec le globe oculaire.'),
        jsonb_build_object('en', 'Expect 8–12 weeks before noticing density gains.',                          'fr', 'Compte 8 à 12 semaines avant un gain de densité visible.')
      ),
      12, 'weeks', 5, 15, 'EUR', 'low', 'community',
      ARRAY['details_and_color.eyelash_density'],
      jsonb_build_object('score_lte', jsonb_build_object('key','details_and_color.eyelash_density','value',6))
    ),
    (
      'eyes.eyelash_dyeing', 'eyes', 'soft', 'cosmetic', 50,
      'Eyelash dyeing',
      'Teinture des cils',
      'For very light lashes that read as invisible. Cheap, low-risk, immediately visible result that frames the gaze.',
      'Pour les cils très clairs qui passent inaperçus. Peu cher, faible risque, résultat immédiat qui met le regard en valeur.',
      jsonb_build_array(
        jsonb_build_object('en', 'Patch-test the dye 24h before on the inner arm.',         'fr', 'Test cutané 24 h avant à l''intérieur du bras.'),
        jsonb_build_object('en', 'Have it done by a salon for the first time.',              'fr', 'Première fois en salon de préférence.'),
        jsonb_build_object('en', 'Refresh every 4–6 weeks.',                                  'fr', 'Renouvelle toutes les 4 à 6 semaines.')
      ),
      6, 'weeks', 15, 40, 'EUR', 'low', 'community',
      ARRAY['details_and_color.eyelash_density'],
      jsonb_build_object('score_lte', jsonb_build_object('key','details_and_color.eyelash_density','value',5))
    ),
    (
      'eyes.eye_patching', 'eyes', 'soft', 'device', 60,
      'Eye patching for asymmetry / amblyopia',
      'Eye patching pour asymétrie / amblyopie',
      'Patching the dominant eye forces the weaker side to engage neural pathways. Useful for mild asymmetry; medical follow-up required for true amblyopia.',
      'Couvrir l''œil dominant force le côté plus faible à activer ses connexions nerveuses. Utile pour les asymétries légères ; suivi médical obligatoire pour une vraie amblyopie.',
      jsonb_build_array(
        jsonb_build_object('en', 'Wear a patch on the stronger eye 1–2h/day.',                   'fr', 'Porte un cache sur l''œil le plus fort 1 à 2 h/jour.'),
        jsonb_build_object('en', 'Pair with focusing exercises (read, focus on a pen tip).',      'fr', 'Associe à des exercices de focalisation (lecture, pointe de stylo).'),
        jsonb_build_object('en', 'Get an ophthalmologist''s opinion before extended use.',         'fr', 'Demande l''avis d''un ophtalmologiste avant un usage prolongé.')
      ),
      12, 'weeks', 5, 20, 'EUR', 'low', 'medical',
      ARRAY['morphology_and_tilt.eye_symmetry'],
      jsonb_build_object('score_lte', jsonb_build_object('key','morphology_and_tilt.eye_symmetry','value',6))
    ),
    (
      'eyes.no_rubbing', 'eyes', 'soft', 'habit', 65,
      'Stop rubbing & face-down sleeping',
      'Arrêter de frotter et dormir sur le ventre',
      'Mechanical trauma is the #1 cause of preventable lid sag, broken capillaries and pigmentation. Eliminate it before any other intervention.',
      'Le traumatisme mécanique est la première cause évitable de relâchement des paupières, capillaires éclatés et pigmentation. À éliminer avant toute autre intervention.',
      jsonb_build_array(
        jsonb_build_object('en', 'Never rub eyes — pat with a clean tissue if itchy.',  'fr', 'Ne frotte jamais — tamponne avec un mouchoir propre si ça démange.'),
        jsonb_build_object('en', 'Sleep on your back; use a silk pillowcase.',           'fr', 'Dors sur le dos ; utilise une taie en soie.'),
        jsonb_build_object('en', 'Treat allergies (antihistamines) to remove the urge.',  'fr', 'Traite les allergies (antihistaminiques) pour supprimer l''envie.')
      ),
      8, 'weeks', 0, 30, 'EUR', 'none', 'medical',
      ARRAY['under_eye_health.support_and_hollows','under_eye_health.pigmentation','eyelids_and_sclera.upper_eyelid_exposure'],
      jsonb_build_object('all', true)
    ),
    (
      'eyes.eyelid_levator_exercise', 'eyes', 'soft', 'exercise', 55,
      'Levator palpebrae training',
      'Entraînement du levator palpebrae',
      'Strengthens the muscle that opens the upper lid, slightly increasing eye ratio and projecting a more alert gaze.',
      'Renforce le muscle qui ouvre la paupière supérieure, augmente légèrement le ratio oculaire et projette un regard plus alerte.',
      jsonb_build_array(
        jsonb_build_object('en', 'Open eyes wide and hold 5s, relax 5s. 3 sets × 10 reps.', 'fr', 'Ouvre les yeux grand 5 s, relâche 5 s. 3 séries × 10 répétitions.'),
        jsonb_build_object('en', 'Keep brows still — only the lids move.',                   'fr', 'Garde les sourcils immobiles — seules les paupières bougent.')
      ),
      8, 'weeks', 0, 0, 'EUR', 'none', 'community',
      ARRAY['eyelids_and_sclera.upper_eyelid_exposure'],
      jsonb_build_object('score_lte', jsonb_build_object('key','eyelids_and_sclera.upper_eyelid_exposure','value',5))
    ),
    (
      'eyes.eyebrow_grooming', 'eyes', 'soft', 'habit', 50,
      'Brow shaping & brushing',
      'Sculptage et brossage des sourcils',
      'Well-shaped, brushed brows frame the eye and instantly improve lateral halo. Highest visible-effect-for-effort soft win.',
      'Des sourcils bien dessinés et brossés encadrent l''œil et améliorent instantanément le halo latéral. Très haut rendement visuel pour l''effort.',
      jsonb_build_array(
        jsonb_build_object('en', 'Tweeze stragglers under the natural arch only.',         'fr', 'Épile uniquement les poils sous l''arc naturel.'),
        jsonb_build_object('en', 'Brush daily with a clear gel; check symmetry in mirror.', 'fr', 'Brosse chaque jour avec un gel transparent ; vérifie la symétrie.'),
        jsonb_build_object('en', 'Do not over-pluck the outer tail; it shortens the gaze.',  'fr', 'Ne sur-épile pas la queue extérieure ; ça raccourcit le regard.')
      ),
      4, 'weeks', 5, 25, 'EUR', 'low', 'community',
      ARRAY['morphology_and_tilt.eye_symmetry'],
      jsonb_build_object('all', true)
    ),

    -- ====================== HARDMAXXING (12) =================================
    (
      'eyes.dermal_filler_infraorbital', 'eyes', 'hard', 'injectable', 90,
      'Infraorbital hyaluronic filler',
      'Filler infraorbitaire à l''acide hyaluronique',
      'High-cohesivity HA micro-injections restore tear-trough volume and reduce fatigue shadows. Reversible with hyaluronidase.',
      'Micro-injections d''acide hyaluronique haute cohésivité pour restaurer le volume de la vallée des larmes et réduire les ombres de fatigue. Réversible avec la hyaluronidase.',
      jsonb_build_array(
        jsonb_build_object('en', 'Choose an oculoplastic surgeon or experienced derm.',         'fr', 'Choisis un chirurgien oculoplasticien ou un dermato expérimenté.'),
        jsonb_build_object('en', 'Expect 1–2 weeks of mild swelling and possible bruising.',     'fr', 'Compte 1 à 2 semaines d''œdème léger et possibles bleus.'),
        jsonb_build_object('en', 'Touch-up at 6 weeks; results last 12–18 months.',              'fr', 'Retouche à 6 semaines ; résultats 12 à 18 mois.')
      ),
      1, 'session', 400, 900, 'EUR', 'medium', 'medical',
      ARRAY['under_eye_health.support_and_hollows'],
      jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.support_and_hollows','value',5))
    ),
    (
      'eyes.upper_blepharoplasty', 'eyes', 'hard', 'surgery', 75,
      'Upper blepharoplasty',
      'Blépharoplastie supérieure',
      'Removes excess skin (and sometimes fat) on the upper lid that hides the eye opening. Indicated for severe hooding that reads as tired.',
      'Retire l''excès de peau (parfois de gras) sur la paupière supérieure qui masque l''ouverture de l''œil. Indiqué pour un hooding sévère qui donne un air fatigué.',
      jsonb_build_array(
        jsonb_build_object('en', 'Consult board-certified oculoplastic surgeon.',           'fr', 'Consulte un oculoplasticien certifié.'),
        jsonb_build_object('en', '7–10 days social downtime; 1–2 weeks for full healing.',   'fr', '7 à 10 jours sans social ; 1 à 2 semaines de cicatrisation.'),
        jsonb_build_object('en', 'Hooded eyes can look very attractive — only operate if hooding actively hides the eye.', 'fr', 'Les yeux hooded peuvent être très attirants — n''opère que si le hooding masque vraiment l''œil.')
      ),
      1, 'session', 2500, 5000, 'EUR', 'high', 'medical',
      ARRAY['eyelids_and_sclera.upper_eyelid_exposure'],
      jsonb_build_object('score_lte', jsonb_build_object('key','eyelids_and_sclera.upper_eyelid_exposure','value',3))
    ),
    (
      'eyes.lower_blepharoplasty', 'eyes', 'hard', 'surgery', 70,
      'Lower blepharoplasty',
      'Blépharoplastie inférieure',
      'Removes or repositions infraorbital fat pads to soften eye bags and the inferior halo. Carries a real risk of post-op hollowness.',
      'Retire ou repositionne les poches graisseuses infraorbitaires pour adoucir les poches et le halo inférieur. Risque réel de creux post-op.',
      jsonb_build_array(
        jsonb_build_object('en', 'Prefer fat repositioning over removal to avoid sunken look.', 'fr', 'Privilégie le repositionnement à l''ablation pour éviter l''effet creusé.'),
        jsonb_build_object('en', '1–2 weeks downtime, possible hematoma.',                       'fr', '1 à 2 semaines d''arrêt, hématome possible.'),
        jsonb_build_object('en', 'Try cold therapy + fillers first if hollowness is the issue.',  'fr', 'Essaie d''abord froid + filler si le problème est le creux.')
      ),
      1, 'session', 3000, 6500, 'EUR', 'high', 'medical',
      ARRAY['under_eye_health.support_and_hollows'],
      jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.support_and_hollows','value',3))
    ),
    (
      'eyes.canthoplasty', 'eyes', 'hard', 'surgery', 80,
      'Canthoplasty (lateral canthal lift)',
      'Canthoplastie (lifting du canthus latéral)',
      'Surgical repositioning of the lateral canthus to create a positive canthal tilt. The most direct intervention to convert "prey" eyes to "hunter" eyes.',
      'Repositionnement chirurgical du canthus latéral pour créer un canthal tilt positif. L''intervention la plus directe pour passer d''yeux "proie" à yeux "hunter".',
      jsonb_build_array(
        jsonb_build_object('en', 'Find a surgeon specialised in fox-eye / canthoplasty.',  'fr', 'Trouve un chirurgien spécialisé en fox-eye / canthoplastie.'),
        jsonb_build_object('en', '2–3 weeks visible swelling; 3–6 months final result.',    'fr', '2 à 3 semaines d''œdème visible ; 3 à 6 mois pour le rendu final.'),
        jsonb_build_object('en', 'Permanent — be 100% sure before booking.',                'fr', 'Permanent — sois sûr à 100 % avant de réserver.')
      ),
      1, 'session', 4000, 9000, 'EUR', 'high', 'medical',
      ARRAY['morphology_and_tilt.canthal_tilt'],
      jsonb_build_object('enum_in', jsonb_build_object('key','morphology_and_tilt.canthal_tilt','values', jsonb_build_array('negative','downturned','downward')))
    ),
    (
      'eyes.canthopexy', 'eyes', 'hard', 'surgery', 65,
      'Canthopexy (lateral lid tightening)',
      'Canthopexie (resserrage de la paupière latérale)',
      'Less invasive than canthoplasty: tightens the supporting structures at the lateral canthus without disinserting them. Good first step.',
      'Moins invasive que la canthoplastie : resserre les structures de soutien du canthus latéral sans les désinsérer. Bonne première étape.',
      jsonb_build_array(
        jsonb_build_object('en', 'Often combined with lower blepharoplasty.',         'fr', 'Souvent combinée à une blépharoplastie inférieure.'),
        jsonb_build_object('en', 'Shorter recovery (~10 days).',                       'fr', 'Récupération plus courte (~10 jours).'),
        jsonb_build_object('en', 'Less dramatic tilt change than full canthoplasty.',  'fr', 'Changement de tilt moins marqué qu''une vraie canthoplastie.')
      ),
      1, 'session', 2500, 5500, 'EUR', 'medium', 'medical',
      ARRAY['morphology_and_tilt.canthal_tilt'],
      jsonb_build_object('enum_in', jsonb_build_object('key','morphology_and_tilt.canthal_tilt','values', jsonb_build_array('negative','neutral','downturned','downward')))
    ),
    (
      'eyes.infraorbital_implants', 'eyes', 'hard', 'surgery', 70,
      'Infraorbital rim implants',
      'Implants infraorbitaires',
      'Permanent silicone or porous polyethylene implants that build out a recessed (negative-vector) lower orbital rim. Best paired with canthoplasty.',
      'Implants permanents en silicone ou polyéthylène poreux qui projettent un rebord orbitaire inférieur reculé (vecteur négatif). À combiner avec une canthoplastie.',
      jsonb_build_array(
        jsonb_build_object('en', 'Consult facial plastic surgeon (e.g. Eppley, Yaremchuk).',  'fr', 'Consulte un chirurgien plasticien facial (ex. Eppley, Yaremchuk).'),
        jsonb_build_object('en', '4–6 weeks recovery; long-term result.',                      'fr', '4 à 6 semaines de récupération ; résultat long terme.'),
        jsonb_build_object('en', 'Reserved for clearly negative orbital vectors.',              'fr', 'Réservé aux vecteurs orbitaires clairement négatifs.')
      ),
      1, 'session', 8000, 18000, 'EUR', 'high', 'medical',
      ARRAY['under_eye_health.support_and_hollows','morphology_and_tilt.orbital_depth'],
      jsonb_build_object('and', jsonb_build_array(
        jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.support_and_hollows','value',3))
      ))
    ),
    (
      'eyes.orbital_decompression', 'eyes', 'hard', 'surgery', 50,
      'Cosmetic orbital decompression',
      'Décompression orbitaire cosmétique',
      'Removes/thins orbital walls so the eyeball settles deeper. Used cosmetically to convert prominent eyes into deep-set ("hunter") eyes. Major surgery.',
      'Retire/affine des parois orbitaires pour que le globe oculaire s''enfonce. Usage cosmétique pour transformer des yeux proéminents en yeux enfoncés ("hunter"). Chirurgie lourde.',
      jsonb_build_array(
        jsonb_build_object('en', 'Few surgeons in the world do this cosmetically — research thoroughly.', 'fr', 'Très peu de chirurgiens dans le monde le font à visée cosmétique — recherche approfondie obligatoire.'),
        jsonb_build_object('en', 'Real risks: double vision, asymmetry, sinus issues.',                    'fr', 'Risques réels : diplopie, asymétrie, complications sinusiennes.'),
        jsonb_build_object('en', 'Lateral wall first, then medial, then floor for safer staging.',          'fr', 'Paroi latérale d''abord, puis médiale, puis plancher pour limiter le risque.')
      ),
      1, 'session', 12000, 25000, 'EUR', 'high', 'medical',
      ARRAY['morphology_and_tilt.orbital_depth'],
      jsonb_build_object('enum_in', jsonb_build_object('key','morphology_and_tilt.orbital_depth','values', jsonb_build_array('shallow','prominent','protruding')))
    ),
    (
      'eyes.laser_resurfacing', 'eyes', 'hard', 'energy', 60,
      'Periocular laser resurfacing',
      'Resurfaçage laser péri-oculaire',
      'Fractional CO₂ or erbium laser stimulates collagen, smooths fine lines and brightens periocular pigmentation.',
      'Laser CO₂ ou erbium fractionné pour stimuler le collagène, lisser les ridules et éclaircir la pigmentation péri-oculaire.',
      jsonb_build_array(
        jsonb_build_object('en', '5–7 days of redness/peeling.',                       'fr', '5 à 7 jours de rougeurs / desquamation.'),
        jsonb_build_object('en', 'Strict SPF for 8 weeks post-treatment.',              'fr', 'SPF strict pendant 8 semaines après.'),
        jsonb_build_object('en', '2–3 sessions spaced 4 weeks apart for full effect.',   'fr', '2 à 3 séances espacées de 4 semaines pour l''effet complet.')
      ),
      3, 'session', 600, 1500, 'EUR', 'medium', 'medical',
      ARRAY['under_eye_health.pigmentation','details_and_color.sclera_clarity'],
      jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.pigmentation','value',5))
    ),
    (
      'eyes.microneedling_pro', 'eyes', 'hard', 'device_clinical', 55,
      'Professional microneedling',
      'Microneedling professionnel',
      'In-office microneedling (with or without RF) increases dermal density and improves periocular skin texture. Less downtime than laser.',
      'Microneedling en cabinet (avec ou sans RF) augmente la densité dermique et améliore la texture péri-oculaire. Moins d''arrêt que le laser.',
      jsonb_build_array(
        jsonb_build_object('en', 'Course of 3–4 sessions, 4 weeks apart.', 'fr', 'Cure de 3 à 4 séances, espacées de 4 semaines.'),
        jsonb_build_object('en', '24–48h redness, no real downtime.',       'fr', '24 à 48 h de rougeurs, pas de vrai arrêt.'),
        jsonb_build_object('en', 'Combine with PRP for added regeneration.', 'fr', 'À combiner avec PRP pour plus de régénération.')
      ),
      4, 'session', 200, 500, 'EUR', 'low', 'medical',
      ARRAY['under_eye_health.support_and_hollows','under_eye_health.pigmentation'],
      jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.pigmentation','value',6))
    ),
    (
      'eyes.prp_periocular', 'eyes', 'hard', 'injectable', 60,
      'Platelet-rich plasma (PRP)',
      'Plasma riche en plaquettes (PRP)',
      'Your own centrifuged platelets injected into the periocular area; growth factors stimulate collagen and brighten the light halo.',
      'Tes propres plaquettes centrifugées, injectées en péri-oculaire ; les facteurs de croissance stimulent le collagène et éclairent le halo de lumière.',
      jsonb_build_array(
        jsonb_build_object('en', '3 sessions spaced 4 weeks apart.', 'fr', '3 séances espacées de 4 semaines.'),
        jsonb_build_object('en', 'Possible bruising for 5–7 days.',   'fr', 'Bleus possibles 5 à 7 jours.'),
        jsonb_build_object('en', 'Pairs well with microneedling.',     'fr', 'Bien complémentaire au microneedling.')
      ),
      3, 'session', 250, 600, 'EUR', 'low', 'medical',
      ARRAY['under_eye_health.pigmentation','details_and_color.sclera_clarity'],
      jsonb_build_object('score_lte', jsonb_build_object('key','under_eye_health.pigmentation','value',6))
    ),
    (
      'eyes.eyelash_extensions', 'eyes', 'hard', 'cosmetic', 45,
      'Eyelash extensions',
      'Extensions de cils',
      'Synthetic lashes glued onto natural lashes, instantly multiplying density. Pure cosmetic, fully reversible by letting them fall out.',
      'Cils synthétiques collés sur les cils naturels qui multiplient instantanément la densité. Purement cosmétique, réversible en les laissant tomber.',
      jsonb_build_array(
        jsonb_build_object('en', 'Choose a discreet, classic set if you''re male.',   'fr', 'Choisis un set discret et classique si tu es un homme.'),
        jsonb_build_object('en', 'Refill every 3–4 weeks; lasts ~6 weeks max.',        'fr', 'Refill toutes les 3 à 4 semaines ; tient ~6 semaines max.'),
        jsonb_build_object('en', 'Avoid water and steam for 24h after each session.',   'fr', 'Évite eau et vapeur 24 h après chaque séance.')
      ),
      1, 'session', 80, 200, 'EUR', 'low', 'community',
      ARRAY['details_and_color.eyelash_density'],
      jsonb_build_object('score_lte', jsonb_build_object('key','details_and_color.eyelash_density','value',5))
    ),
    (
      'eyes.colored_contacts', 'eyes', 'hard', 'cosmetic', 40,
      'Colored contact lenses',
      'Lentilles de contact colorées',
      'Reversible eye color change. Useful to test a tone before committing to permanent procedures, or to enhance a low-saturation iris.',
      'Changement de couleur d''œil réversible. Utile pour tester une teinte avant tout définitif, ou pour rehausser un iris peu saturé.',
      jsonb_build_array(
        jsonb_build_object('en', 'Get a prescription even if your vision is fine — fit is critical.', 'fr', 'Prescription obligatoire même sans correction — l''ajustement est critique.'),
        jsonb_build_object('en', 'Never sleep in them; never wear over 8h/day.',                       'fr', 'Ne dors jamais avec ; pas plus de 8 h/jour.'),
        jsonb_build_object('en', 'Replace per manufacturer schedule (daily / monthly).',                'fr', 'Remplace selon le calendrier (journalier / mensuel).')
      ),
      1, 'session', 20, 80, 'EUR', 'medium', 'medical',
      ARRAY['details_and_color.iris_color'],
      jsonb_build_object('all', true)
    )
  ) AS t (
    id, worker, type, category, priority,
    title_en, title_fr, summary_en, summary_fr, steps,
    duration_value, duration_unit, cost_min, cost_max, cost_currency, risk, evidence,
    targets, conditions
  )
)
INSERT INTO public.scoremax_recommendations (
  id, worker, type, category, priority,
  title_en, title_fr, summary_en, summary_fr, steps,
  duration_value, duration_unit, cost_min, cost_max, cost_currency, risk, evidence,
  targets, conditions
)
SELECT
  id, worker, type, category, priority,
  title_en, title_fr, summary_en, summary_fr, steps,
  duration_value, duration_unit, cost_min, cost_max, cost_currency, risk, evidence,
  targets, conditions
FROM recs
ON CONFLICT (id) DO UPDATE SET
  worker         = EXCLUDED.worker,
  type           = EXCLUDED.type,
  category       = EXCLUDED.category,
  priority       = EXCLUDED.priority,
  title_en       = EXCLUDED.title_en,
  title_fr       = EXCLUDED.title_fr,
  summary_en     = EXCLUDED.summary_en,
  summary_fr     = EXCLUDED.summary_fr,
  steps          = EXCLUDED.steps,
  duration_value = EXCLUDED.duration_value,
  duration_unit  = EXCLUDED.duration_unit,
  cost_min       = EXCLUDED.cost_min,
  cost_max       = EXCLUDED.cost_max,
  cost_currency  = EXCLUDED.cost_currency,
  risk           = EXCLUDED.risk,
  evidence       = EXCLUDED.evidence,
  targets        = EXCLUDED.targets,
  conditions     = EXCLUDED.conditions,
  updated_at     = NOW();
