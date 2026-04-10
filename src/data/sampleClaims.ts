import { ClaimInput } from "@/types";

export const sampleClaims: ClaimInput[] = [
  {
    claimId: "C1",
    description:
      "Rear-end collision at a traffic signal. Minor bumper damage and a small scratch on the boot lid. Vehicle is drivable.",
    policyType: "Comprehensive",
    claimAmount: 25000,
    pastClaims: 0,
    documentsStatus: "Complete",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Car_bumper_damage.jpg/640px-Car_bumper_damage.jpg",
  },
  {
    claimId: "C2",
    description:
      "Flooded engine after driving through waterlogged road during monsoon. Car stalled and will not restart.",
    policyType: "Third-Party",
    claimAmount: 90000,
    pastClaims: 1,
    documentsStatus: "Complete",
  },
  {
    claimId: "C3",
    description: "Small scratch on the front bumper.",
    policyType: "Comprehensive",
    claimAmount: 85000,
    pastClaims: 5,
    documentsStatus: "Complete",
  },
  {
    claimId: "C4",
    description:
      "Side collision at a parking lot. Left door panel is dented and the rear view mirror is broken off.",
    policyType: "Comprehensive",
    claimAmount: 45000,
    pastClaims: 0,
    documentsStatus: "Missing",
  },
  {
    claimId: "C5",
    description: "Minor paint scratch on the hood. Barely noticeable.",
    policyType: "Comprehensive",
    claimAmount: 30000,
    pastClaims: 0,
    documentsStatus: "Complete",
    imageUrl:
      "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Car_accident_2009.jpg/640px-Car_accident_2009.jpg",
  },
];

// Pre-loaded for TripleClaimPanel (slots 1, 2, 3 = C1, C2, C3)
export const tripleClaimDefaults = [sampleClaims[0], sampleClaims[1], sampleClaims[2]];
