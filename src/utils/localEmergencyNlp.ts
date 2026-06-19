import { EmergencyIntel, EmergencyType } from "../types";

/**
 * Local Natural Language Processing Engine for Tactical Emergency Information Extraction
 * Bypasses cloud APIs completely to provide real-time, deterministic, and safe emergency classification in the sandbox.
 */
export function analyzeEmergencySpeech(text: string): EmergencyIntel {
  const normalized = text.toLowerCase();
  
  if (!text || text.trim() === "" || text.includes("[Trigger process pipeline")) {
    return {
      type: "UNKNOWN",
      confidence: 0,
      location: "Undefined (Awaiting analysis text)",
      hazards: [],
      urgency: "LOW",
      casualties: "None detected",
      tacticalAction: ["Awaiting incoming communication stream..."]
    };
  }

  // 1. Classify Emergency Type with custom scoring weights
  const scores: Record<EmergencyType, number> = {
    FIRE: 0,
    MEDICAL: 0,
    VEHICLE_CRASH: 0,
    SECURITY: 0,
    HAZMAT: 0,
    COLLAPSE: 0,
    UNKNOWN: 0
  };

  // Keyword lexicons
  const lexicons: Record<Exclude<EmergencyType, "UNKNOWN">, string[]> = {
    FIRE: [
      "fire", "smoke", "blaze", "burn", "flame", "engulfed", "combustion", "spark", "explosion", 
      "incinerator", "extinguisher", "firefighter", "alarm went off", "arson", "forest fire"
    ],
    MEDICAL: [
      "medical", "ambulance", "paramedic", "hospital", "patient", "injury", "injuries", "unconscious", 
      "heart attack", "cardiac", "stroke", "bleeding", "hemorrhage", "respiratory", "choking", "seizure", 
      "concussion", "fracture", "chest pain", "not breathing"
    ],
    VEHICLE_CRASH: [
      "crash", "collision", "accident", "overturned", "pileup", "vehicle", "highway crash", "intersection", 
      "head-on", "brakes failed", "pedestrian hit", "truck", "motorcycle", "rear-ended"
    ],
    SECURITY: [
      "security", "shots fired", "shooter", "hostage", "armed", "threat", "robbery", "intruder", 
      "assault", "trespassing", "weapon", "active threat", "gunfire", "barricaded"
    ],
    HAZMAT: [
      "gas leak", "chemical spill", "toxic", "poisonous", "chlorine", "corrosive", "acid", "sulfur", 
      "radiation", "nuclear", "hazmat", "fumes", "carbon monoxide", "leakage", "contamination"
    ],
    COLLAPSE: [
      "collapse", "collapsed", "rubble", "crushed", "structural failure", "cave-in", "landslide", 
      "mudslide", "sinkhole", "debris", "trapped under", "entrapment", "demolished"
    ]
  };

  // Run keyword occurrence counting
  Object.entries(lexicons).forEach(([type, words]) => {
    words.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b|${word}`, "g");
      const matches = normalized.match(regex);
      if (matches) {
        scores[type as EmergencyType] += matches.length * 10; // base score weight
      }
    });
  });

  // Determine dominant category
  let maxScore = 0;
  let detectedType: EmergencyType = "UNKNOWN";
  
  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedType = type as EmergencyType;
    }
  }


  // Calculate confidence score (heuristic mapping)
  let confidence = 0;
  if (detectedType !== "UNKNOWN") {
    // scale between 50 and 98 based on match intensity
    confidence = Math.min(98, 45 + maxScore * 1.5);
  }

  // 2. Extract Specific Location Pointer
  let location = "Not specified during transmission";
  
  // Regex pattern matching for standard location phrases
  const locationPatterns = [
    /at\s+the\s+([a-zA-Z0-9\s]+(?:building|intersection|corner|highway|station|road|street|avenue|dock|lobby|floor|sector|room|park|plaza|mile\s*marker))/i,
    /on\s+([a-zA-Z0-9\s]+(?:highway|interstate|route|rd|st|ave|blvd|lane|drive|bridge))/i,
    /near\s+the\s+([a-zA-Z0-9\s]+(?:mall|river|park|tunnel|factory|facility|refinery|subway|airport))/i,
    /inside\s+([a-zA-Z50-9\s]+(?:office|sector|hangar|dock|basement|warehouse|garage|elevator|shaft))/i,
    /heading\s+(?:north|south|east|west)\s+on\s+([a-zA-Z0-9\s]+)/i,
    /floor\s*([0-9a-zA-Z\-#]+)/i,
    /coordinates\s*([0-9\.\-\s,]+)/i
  ];

  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      location = match[1].trim();
      // Format clean coordinate names
      if (pattern.source.includes("coordinates")) {
        location = `GPS Grid: [${location}]`;
      } else if (pattern.source.includes("floor")) {
        location = `Building Floor ${location}`;
      }
      break;
    }
  }

  // 3. Detect Active Hazards
  const hazardsList = [
    { key: "smoke", label: "Toxic Smoke Inhalation Risk" },
    { key: "fire", label: "Active Conflagration / Inferno" },
    { key: "electric", label: "High Voltage / Power Line Shock Hazard" },
    { key: "wire", label: "Exposed Electrical Conductors" },
    { key: "combustible", label: "Flammable Fuel / Exploding Materials" },
    { key: "gas", label: "Pressurized Toxic Gas Leak" },
    { key: "leak", label: "Hazardous Chemical Contamination" },
    { key: "acid", label: "Corrosive Acid Leak" },
    { key: "rubble", label: "Structural Unsteadiness / Falling Debris" },
    { key: "debris", label: "Instability Risk" },
    { key: "radiation", label: "Active Radiation Threat" },
    { key: "ammo", label: "Active Ballistic Danger / Shots" },
    { key: "shooter", label: "Armed Hostile Threat" }
  ];

  const hazards: string[] = [];
  hazardsList.forEach(item => {
    if (normalized.includes(item.key)) {
      hazards.push(item.label);
    }
  });

  // Fallback default hazards based on category if none extracted explicitly
  if (hazards.length === 0) {
    if (detectedType === "FIRE") hazards.push("High Temperature Flame Propagation");
    if (detectedType === "HAZMAT") hazards.push("Vapor Plume Spread Risk");
    if (detectedType === "COLLAPSE") hazards.push("Unstable Overhead Structures");
    if (detectedType === "VEHICLE_CRASH") hazards.push("Leaking Fluids & Spark Source");
  }

  // 4. Detect Casualties / Entrapped Personnel
  let casualties = "No entrapped or injured persons clearly specified";
  const casualtyMatches = [
    /(\d+|two|three|four|five|multiple|several)\s+(?:people|victims|casualties|passengers|workers|wounded)\s+trapped/i,
    /trap(?:ped)?\s+inside/i,
    /unconscious\s+(?:person|victim|driver|patient)/i,
    /severe\s+(?:bleeding|head\s+injury|chest\s+pain)/i,
    /cardiac\s+arrest/i
  ];

  for (const pattern of casualtyMatches) {
    const match = text.match(pattern);
    if (match) {
      if (match[1]) {
        casualties = `${match[1].toUpperCase()} individual(s) confirmed trapped in target zone`;
      } else if (normalized.includes("unconscious")) {
        casualties = "Unconscious casualty requiring immediate respiratory support";
      } else {
        casualties = "Confirmed entrapment/injuries requiring heavy rescue machinery";
      }
      break;
    }
  }

  // 5. Establish Urgency Level
  let urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" = "LOW";
  const isHeartAttack = normalized.includes("heart attack") || normalized.includes("cardiac") || normalized.includes("not breathing");
  const isArmedThreat = detectedType === "SECURITY" && (normalized.includes("shooter") || normalized.includes("gun"));
  const isEntrapped = normalized.includes("trapped") || normalized.includes("rubble");
  const isSpillLeak = detectedType === "HAZMAT";

  if (isHeartAttack || isArmedThreat || isEntrapped) {
    urgency = "CRITICAL";
  } else if (detectedType !== "UNKNOWN" || hazards.length > 0) {
    urgency = "HIGH";
  } else if (normalized.length > 10) {
    urgency = "MEDIUM";
  }

  // 6. Tactical Action Generation (Dynamic local dispatch handbook)
  const tacticalAction: string[] = [];
  
  switch (detectedType) {
    case "FIRE":
      tacticalAction.push("Initiate immediate structural evacuation of all sectors.");
      tacticalAction.push("Dispatch Engine Company & Heavy Rescue equipment.");
      if (hazards.includes("Flammable Fuel / Exploding Materials") || normalized.includes("chemical")) {
        tacticalAction.push("CRITICAL: Establish a 1000-ft isolation perimeter. Use foam suppressants.");
      } else {
        tacticalAction.push("Deploy dry-pipe ventilation and structural cooling.");
      }
      break;
    case "MEDICAL":
      tacticalAction.push("Deploy ALS (Advanced Life Support) Paramedics immediately.");
      tacticalAction.push("Transmit CPR / AED protocol coaching to on-site personnel.");
      if (urgency === "CRITICAL") {
        tacticalAction.push("Provide real-time telemetry to regional trauma unit.");
      }
      break;
    case "VEHICLE_CRASH":
      tacticalAction.push("Alert State Patrol and coordinate localized traffic diversions.");
      tacticalAction.push("Dispatch extrication equipment (Jaws of Life) to clear entrapments.");
      if (hazards.some(h => h.includes("Fluids") || h.includes("Chemical"))) {
        tacticalAction.push("Deploy absorbents to mitigate flammable fluid catchment.");
      }
      break;
    case "SECURITY":
      tacticalAction.push("TACTICAL ALERT: Instruct incident commander to hold secure cover.");
      tacticalAction.push("Establish sterile radio channel for specialized tactical SWAT squads.");
      tacticalAction.push("Implement lockdowns across all sector access routes.");
      break;
    case "HAZMAT":
      tacticalAction.push("Establish immediate Hazard Control Zone boundaries (Hot/Warm/Cold zones).");
      tacticalAction.push("MANDATE level-A vapor-tight encapsulation suits for responding teams.");
      tacticalAction.push("Execute continuous air sampling and water runoff prevention protocols.");
      break;
    case "COLLAPSE":
      tacticalAction.push("Mobilize Urban Search and Rescue (US&R) structural collapse specialists.");
      tacticalAction.push("Deploy thermal imaging cameras and acoustic listening instruments.");
      tacticalAction.push("Initiate secondary framing shoring to prevent further ceiling collapse.");
      break;
    default:
      tacticalAction.push("Maintain standard incoming frequency monitoring.");
      tacticalAction.push("Verify transmission carrier origin and request vocal status confirmation.");
  }

  return {
    type: detectedType,
    confidence,
    location,
    hazards,
    urgency,
    casualties,
    tacticalAction
  };
}
