// Interactive Tactical Emergency Intelligence Types
export type EmergencyType = "FIRE" | "MEDICAL" | "VEHICLE_CRASH" | "SECURITY" | "HAZMAT" | "COLLAPSE" | "UNKNOWN";

export interface EmergencyIntel {
  type: EmergencyType;
  confidence: number; // 0 to 100
  location: string;
  hazards: string[];
  urgency: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  casualties: string;
  tacticalAction: string[];
}
