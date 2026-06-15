/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Season {
  id: string;
  number: number;
  startTime: string; // ISO String
  endTime: string; // ISO String
  winnerCountryId?: string;
  winnerCountryName?: string;
  active: boolean;
}

export interface Country {
  id: string;
  userId: string;
  name: string;
  flagUrl: string; // can be inline emoji, svg string, or url
  color: string; // hex string or tailwind class
  description: string;
  capital: string;
  leaderName: string;
  
  // Resources
  gold: number;
  oil: number;
  iron: number;
  food: number;
  electricity: number; // current availability
  population: number;
  unemploymentRate: number; // percentage (0 - 100)
  taxRate: number; // percentage (typically 5 - 30)
  
  // Tech & Alliances
  allianceId: string | null;
  allianceName: string | null;
  joinedAllianceAt?: string | null;
  
  // Units (Army counts directly in country or divided per territory)
  army: Army;
  
  // Tracking
  createdAt: string;
  lastHarvestTime: string; // For resource ticking
  lastAirstrikeTime?: number; // Anti-spam cooldown feature
  isBanned?: boolean;
  isBot?: boolean;          // Whether controlled by a dynamic AI bot
  empireCredits: number;    // Premium Gold Credits currency 💎
}

export interface Army {
  infantry: number;
  specialForces: number;
  tanks: number;
  artillery: number;
  antiAir: number;
  jets: number;
  reconPlanes: number;
  warships: number;
  submarines: number;
  missiles: number;
}

export type ResourceType = 'gold' | 'oil' | 'iron' | 'food' | 'electricity';

export interface Territory {
  id: string; // e.g. "T01", "T02"
  name: string;
  ownerCountryId: string | null; // null represents Barbarian / Independent
  ownerCountryName: string | null;
  flagEmoji: string; // flag of the occupying country
  color: string; // owner country color
  posX: number; // percentage on map (0-100)
  posY: number; // percentage on map (0-100)
  type: 'plain' | 'mountain' | 'coastal' | 'desert';
  resourceSpecialty: ResourceType;
  resourceMultiplier: number; // production bonus e.g. 1.5
  garrison: Garrison;
  battleStatus?: 'idle' | 'clashing';
  battleAttackerId?: string | null;
  battleAttackerName?: string | null;
  battleReleaseTime?: number | null;
  battleForces?: Partial<Garrison> | null;
}

export interface Garrison {
  infantry: number;
  specialForces: number;
  tanks: number;
  artillery: number;
  antiAir: number;
  jets: number;
  missiles: number;
}

export interface Building {
  id: string;
  countryId: string;
  type: 'mine' | 'farm' | 'factory' | 'power_station' | 'port' | 'airport' | 'military_base' | 'research_center';
  name: string;
  level: number;
  count: number;
  cost: {
    gold: number;
    iron: number;
    oil: number;
  };
}

export interface ResearchTech {
  id: string;
  name: string;
  description: string;
  type: 'economy' | 'military' | 'defense' | 'production';
  level: number;
  costGold: number;
  costIron: number;
  durationHours: number;
  multiplier: number;
}

export interface ResearchState {
  id: string; // countryId
  economyLevel: number;
  militaryLevel: number;
  defenseLevel: number;
  productionLevel: number;
}

export interface Alliance {
  id: string;
  name: string;
  tag: string;
  description: string;
  leaderCountryId: string;
  leaderCountryName: string;
  members: AllianceMember[];
  resourcePool: {
    gold: number;
    oil: number;
    iron: number;
    food: number;
  };
  createdAt: string;
}

export interface AllianceMember {
  countryId: string;
  countryName: string;
  flagEmoji: string;
  role: 'leader' | 'officer' | 'member';
}

export interface BattleReport {
  id: string;
  seasonId: string;
  timestamp: string;
  attackerId: string;
  attackerName: string;
  attackerFlagEmoji: string;
  defenderId: string | null; // null = barbarians
  defenderName: string | null;
  defenderFlagEmoji: string;
  territoryId: string;
  territoryName: string;
  won: boolean;
  
  initialAttackingForce: Partial<Army>;
  survivingAttackingForce: Partial<Army>;
  initialDefendingForce: Partial<Army>;
  survivingDefendingForce: Partial<Army>;
  
  stolenResources?: {
    gold: number;
    oil: number;
    iron: number;
    food: number;
  };
  destroyedBuildings?: string[];
  log: string[];
}

export interface ChatMessage {
  id: string;
  senderId: string; // countryId or userId
  senderCountryName: string;
  senderFlagEmoji: string;
  senderColor: string;
  text: string;
  timestamp: number; // millisecond timestamp
  allianceId: string | null; // null = global, filled = alliance-only
  recipientId: string | null; // null = global/alliance, filled = private DM
  recipientCountryName?: string | null;
}

export interface WorldEvent {
  id: string;
  title: string;
  description: string;
  type: 'disaster' | 'prosperity' | 'crisis' | 'discovery';
  severity: number; // 1-10
  effect: string; // description of the penalty/bonus
  targetTerritoryId?: string | null;
  timestamp: string;
}

export interface Spy {
  id: string;
  ownerCountryId: string;
  ownerCountryName: string;
  targetCountryId: string;
  targetCountryName: string;
  status: 'active' | 'caught' | 'successful';
  mission: 'intel' | 'steal_oil' | 'steal_gold' | 'sabotage_defense';
  logs: string[];
  createdAt: string;
}

export interface AdminStats {
  totalPlayers: number;
  totalCountries: number;
  totalAlliances: number;
  totalWars: number;
  activeSeason: number;
}

export interface MapUnit {
  id: string;
  matchId: string;
  ownerCountryId: string;
  ownerCountryName: string;
  color: string;
  type: 'soldier' | 'tank' | 'jet' | 'base' | 'missile';
  hp: number;
  maxHp: number;
  attack: number;
  speed: number; // For map movement calculation
  range: number; // Attack range in map coordinates (or degrees)
  lat: number;
  lng: number;
  targetLat: number | null;
  targetLng: number | null;
  status: 'idle' | 'moving' | 'fighting';
  lastUpdatedAt: number; // timestamp for movement interpolation
}

export interface GameMatch {
  id: string;
  name: string;
  createdAt: string; // ISO timestamp
  active: boolean;
}

