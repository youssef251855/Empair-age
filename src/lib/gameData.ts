/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ResearchTech, ResourceType } from '../types';

export const FLAG_PRESETS = [
  '🇸🇦', '🇪🇬', '🇩🇿', '🇲🇦', '🇮🇶', '🇯🇴', '🇸🇾', '🇵🇸', '🇺🇪', '🇰🇼',
  '🇶🇦', '🇧🇭', '🇴🇲', '🇾🇪', '🇱🇧', '🇹🇳', '🇱🇾', '🇸🇩', '🇺🇸', '🇬🇧',
  '🇷🇺', '🇨🇳', '🇫🇷', '🇩🇪', '🇯🇵', '🇰🇷', '🇮🇹', '🇨🇦', '🇧🇷', '🇹🇷'
];

export const COLOR_PRESETS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Orange
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#eab308'  // Yellow
];

// Building configuration details
export interface BuildingDef {
  type: string;
  name: string;
  arabicName: string;
  description: string;
  cost: { gold: number; iron: number; oil: number };
  production: { resource: ResourceType; amount: number; description: string };
  energyDemand: number;
}

export const BUILDING_DEFS: Record<string, BuildingDef> = {
  mine: {
    type: 'mine',
    name: 'Iron Mine',
    arabicName: 'منجم حديد',
    description: 'يستخرج الحديد الخام لخدمة صناعة الأسلحة والبناء.',
    cost: { gold: 200, iron: 50, oil: 10 },
    production: { resource: 'iron', amount: 30, description: '+30 حديد/ساعة' },
    energyDemand: 5
  },
  farm: {
    type: 'farm',
    name: 'Agricultural Grid',
    arabicName: 'مزرعة متطورة',
    description: 'تنتج الغذاء للحفاظ على استقرار المواطنين وتقليل البطالة.',
    cost: { gold: 150, iron: 30, oil: 5 },
    production: { resource: 'food', amount: 45, description: '+45 غذاء/ساعة' },
    energyDemand: 2
  },
  factory: {
    type: 'factory',
    name: 'Industrial Compound',
    arabicName: 'مجمع صناعي',
    description: 'يصفي النفط وينتج المعدات الثقيلة، ويوفر وظائف للمواطنين.',
    cost: { gold: 350, iron: 120, oil: 30 },
    production: { resource: 'oil', amount: 25, description: '+25 نفط/ساعة' },
    energyDemand: 10
  },
  power_station: {
    type: 'power_station',
    name: 'Nuclear Reactor',
    arabicName: 'محطة طاقة نووية',
    description: 'تولد الكهرباء لتشغيل المصانع والمنشآت الدفاعية.',
    cost: { gold: 500, iron: 200, oil: 50 },
    production: { resource: 'electricity', amount: 100, description: '+100 ميجاوات/ساعة' },
    energyDemand: 0
  },
  research_center: {
    type: 'research_center',
    name: 'Research Tech Park',
    arabicName: 'مركز أبحاث استراتيجي',
    description: 'يفتح تقنيات جديدة ترفع من كفاءة الجيش والمصانع.',
    cost: { gold: 400, iron: 80, oil: 40 },
    production: { resource: 'gold', amount: 15, description: '+15 اقتصاد علمي/ساعة' },
    energyDemand: 15
  },
  military_base: {
    type: 'military_base',
    name: 'Garrison Fortress',
    arabicName: 'قاعدة عسكرية',
    description: 'تدرب وتحشد الجيوش لغزو مناطق جديدة وتأمين الحدود.',
    cost: { gold: 300, iron: 150, oil: 35 },
    production: { resource: 'electricity', amount: -5, description: 'تستهلك كهرباء وتضاعف دفاع الأرض' },
    energyDemand: 8
  }
};

// Military Unit definitions
export interface UnitDef {
  type: string;
  name: string;
  arabicName: string;
  description: string;
  cost: { gold: number; iron: number; oil: number; food: number };
  power: number; // attack score
  defense: number; // defense score
  speed: number; // speed or range stats
}

export const UNIT_DEFS: Record<string, UnitDef> = {
  infantry: {
    type: 'infantry',
    name: 'Regular Infantry',
    arabicName: 'مشاة نظامية',
    description: 'القوات الأساسية للسيطرة على الأرض وتثبيت الحكم.',
    cost: { gold: 10, iron: 5, oil: 0, food: 2 },
    power: 5,
    defense: 8,
    speed: 1
  },
  specialForces: {
    type: 'specialForces',
    name: 'Special Forces',
    arabicName: 'قوات خاصة صاعقة',
    description: 'قوات هجومية كوماندوز متسللة ذات قوة نيران هائلة ومخادعة.',
    cost: { gold: 35, iron: 15, oil: 2, food: 5 },
    power: 18,
    defense: 12,
    speed: 3
  },
  tanks: {
    type: 'tanks',
    name: 'Armored Division',
    arabicName: 'فرقة دبابات مدرعة',
    description: 'العمود الفقري للهجوم البري الثقيل لتدمير تحصينات العدو.',
    cost: { gold: 120, iron: 80, oil: 30, food: 0 },
    power: 45,
    defense: 40,
    speed: 2
  },
  artillery: {
    type: 'artillery',
    name: 'Heavy Artillery',
    arabicName: 'مدفعية ثقيلة بعيدة المدى',
    description: 'تقوم بقصف معسكرات العدو وتدمير المباني الدفاعية بكفاءة.',
    cost: { gold: 80, iron: 60, oil: 10, food: 0 },
    power: 35,
    defense: 15,
    speed: 1
  },
  jets: {
    type: 'jets',
    name: 'Tactical Fighter Jets',
    arabicName: 'طائرات مقاتلة نفاثة',
    description: 'فرض الهيمنة الجوية واستهداف القواعد بسرعة وخاطفة.',
    cost: { gold: 250, iron: 150, oil: 80, food: 0 },
    power: 95,
    defense: 60,
    speed: 5
  },
  reconPlanes: {
    type: 'reconPlanes',
    name: 'Reconnaissance UAV',
    arabicName: 'طائرات استطلاع وتجسس',
    description: 'تكشف دفاعات العدو وثكناته دون أن يلاحظ.',
    cost: { gold: 90, iron: 30, oil: 25, food: 0 },
    power: 5,
    defense: 10,
    speed: 4
  },
  warships: {
    type: 'warships',
    name: 'Guided Missile Destroyer',
    arabicName: 'مدمرة بحرية حربية',
    description: 'تسيطر على الموانئ وتقطع خطوط إمداد السلع الساحلية للعدو.',
    cost: { gold: 400, iron: 250, oil: 120, food: 0 },
    power: 150,
    defense: 180,
    speed: 2
  },
  submarines: {
    type: 'submarines',
    name: 'Nuclear Submarine',
    arabicName: 'غواصة هجومية صامتة',
    description: 'تتربص وتضرب الأساطيل البحرية من الأعماق بسرية تامة.',
    cost: { gold: 450, iron: 300, oil: 150, food: 0 },
    power: 180,
    defense: 110,
    speed: 3
  },
  antiAir: {
    type: 'antiAir',
    name: 'Anti-Air Defense',
    arabicName: 'منظومة دفاع جوي',
    description: 'تحمي سماء المقاطعة من الغارات الجوية وتمتلك قدرة اسقاط المقاتلات والصواريخ.',
    cost: { gold: 150, iron: 100, oil: 50, food: 0 },
    power: 10,
    defense: 80,
    speed: 1
  },
  missiles: {
    type: 'missiles',
    name: 'ICBM Missile launcher',
    arabicName: 'صواريخ باليستية مدمرة',
    description: 'قادرة على قذف الموت وتدمير عاصمة الخصم بضرر هائل جداً ولكنها مكلفة.',
    cost: { gold: 600, iron: 400, oil: 200, food: 0 },
    power: 350,
    defense: 0,
    speed: 10
  }
};

// Research categories list
export const RESEARCH_TECHS: ResearchTech[] = [
  {
    id: 'eco_01',
    name: 'Digital Banking Systems',
    description: 'يرفع كفاءة تحصيل الضرائب بنسبة 15% ويقلل من الفساد.',
    type: 'economy',
    level: 1,
    costGold: 300,
    costIron: 50,
    durationHours: 1,
    multiplier: 1.15
  },
  {
    id: 'eco_02',
    name: 'Offshore Resource Extraction',
    description: 'يزيد كميات استخراج النفط والحديد من المناجم التابعة بـ 20%.',
    type: 'production',
    level: 1,
    costGold: 450,
    costIron: 100,
    durationHours: 2,
    multiplier: 1.20
  },
  {
    id: 'mil_01',
    name: 'Advanced Composite Armor',
    description: 'يرفع قوة دفاع الدبابات والمشاة بنسبة 20%.',
    type: 'military',
    level: 1,
    costGold: 500,
    costIron: 150,
    durationHours: 2.5,
    multiplier: 1.2
  },
  {
    id: 'mil_02',
    name: 'Stealth Aerospace Engineering',
    description: 'يزيد دقة وقوة غارات المقاتلات الجوية بـ 25% ضد دفاعات العدو.',
    type: 'military',
    level: 1,
    costGold: 800,
    costIron: 200,
    durationHours: 4,
    multiplier: 1.25
  },
  {
    id: 'def_01',
    name: 'Thermal Imaging Base Shields',
    description: 'يرفع قوة دفاع الحصون والمناطق المحتلة بنسبة 30% ضد الغزاة.',
    type: 'defense',
    level: 1,
    costGold: 400,
    costIron: 120,
    durationHours: 1.5,
    multiplier: 1.3
  }
];

// Predefined 36 Territories detailing geography and resource modifiers
export interface TerritoryTemplate {
  id: string;
  name: string;
  type: 'plain' | 'mountain' | 'coastal' | 'desert';
  resourceSpecialty: ResourceType;
  resourceMultiplier: number;
  posX: number;
  posY: number;
}

export const MAP_TERRITORIES: TerritoryTemplate[] = [
  // Middle East & North Africa
  { id: 'T01', name: 'شبه الجزيرة العربية (نجد)', type: 'desert', resourceSpecialty: 'oil', resourceMultiplier: 1.8, posX: 58, posY: 48 },
  { id: 'T02', name: 'حقول النفط الشرقية (الأحساء)', type: 'desert', resourceSpecialty: 'oil', resourceMultiplier: 2.0, posX: 62, posY: 50 },
  { id: 'T03', name: 'دلتا النيل (مصر الساحلية)', type: 'coastal', resourceSpecialty: 'food', resourceMultiplier: 1.6, posX: 50, posY: 46 },
  { id: 'T04', name: 'الصعيد وغرب النيل', type: 'desert', resourceSpecialty: 'iron', resourceMultiplier: 1.4, posX: 48, posY: 52 },
  { id: 'T05', name: 'جبال الشام المحصنة', type: 'mountain', resourceSpecialty: 'iron', resourceMultiplier: 1.5, posX: 54, posY: 42 },
  { id: 'T06', name: 'بلاد الرافدين والفرات', type: 'plain', resourceSpecialty: 'food', resourceMultiplier: 1.7, posX: 58, posY: 40 },
  { id: 'T07', name: 'ساحل قرطاج (تونس)', type: 'coastal', resourceSpecialty: 'gold', resourceMultiplier: 1.5, posX: 42, posY: 42 },
  { id: 'T08', name: 'غرب الأطلس (المغرب)', type: 'mountain', resourceSpecialty: 'iron', resourceMultiplier: 1.6, posX: 32, posY: 44 },
  { id: 'T09', name: 'الصحراء الكبرى الوسطى', type: 'desert', resourceSpecialty: 'electricity', resourceMultiplier: 1.8, posX: 38, posY: 55 },
  
  // Europe
  { id: 'T10', name: 'حقول راينلاند الصناعية', type: 'plain', resourceSpecialty: 'iron', resourceMultiplier: 1.7, posX: 44, posY: 28 },
  { id: 'T11', name: 'السهوب البيرينية الإسبانية', type: 'coastal', resourceSpecialty: 'food', resourceMultiplier: 1.4, posX: 36, posY: 34 },
  { id: 'T12', name: 'الألب السويسرية الحصينة', type: 'mountain', resourceSpecialty: 'gold', resourceMultiplier: 1.9, posX: 44, posY: 32 },
  { id: 'T13', name: 'السهب الأوكراني الخصيب', type: 'plain', resourceSpecialty: 'food', resourceMultiplier: 2.0, posX: 55, posY: 28 },
  { id: 'T14', name: 'حوض الأورال المعدني', type: 'mountain', resourceSpecialty: 'iron', resourceMultiplier: 1.8, posX: 65, posY: 22 },
  { id: 'T15', name: 'سهول سيبيريا الباردة', type: 'plain', resourceSpecialty: 'oil', resourceMultiplier: 1.6, posX: 75, posY: 18 },
  { id: 'T16', name: 'ساحل بحر الشمال البريطاني', type: 'coastal', resourceSpecialty: 'electricity', resourceMultiplier: 1.5, posX: 38, posY: 24 },
  
  // Americas
  { id: 'T17', name: 'تكساس النفطية الهائلة', type: 'plain', resourceSpecialty: 'oil', resourceMultiplier: 1.9, posX: 15, posY: 38 },
  { id: 'T18', name: 'السهول الكبرى الأمريكية', type: 'plain', resourceSpecialty: 'food', resourceMultiplier: 1.8, posX: 14, posY: 32 },
  { id: 'T19', name: 'وادي السيليكون التكنولوجي', type: 'coastal', resourceSpecialty: 'electricity', resourceMultiplier: 2.0, posX: 8, posY: 34 },
  { id: 'T20', name: 'جبال روكي المحصنة', type: 'mountain', resourceSpecialty: 'iron', resourceMultiplier: 1.6, posX: 11, posY: 28 },
  { id: 'T21', name: 'كندا الصنوبرية الشاسعة', type: 'desert', resourceSpecialty: 'oil', resourceMultiplier: 1.5, posX: 12, posY: 18 },
  { id: 'T22', name: 'غابات الأمازون البرازيلية', type: 'plain', resourceSpecialty: 'food', resourceMultiplier: 1.7, posX: 22, posY: 64 },
  { id: 'T23', name: 'جبال الأنديز التشيلية', type: 'mountain', resourceSpecialty: 'iron', resourceMultiplier: 1.8, posX: 18, posY: 76 },
  { id: 'T24', name: 'بامباس الأرجنتين', type: 'plain', resourceSpecialty: 'food', resourceMultiplier: 1.5, posX: 21, posY: 82 },
  
  // Asia & Far East
  { id: 'T25', name: 'منطقة منشوريا الصناعية', type: 'plain', resourceSpecialty: 'iron', resourceMultiplier: 1.7, posX: 79, posY: 30 },
  { id: 'T26', name: 'حوض شينجيانغ الغربي', type: 'desert', resourceSpecialty: 'oil', resourceMultiplier: 1.6, posX: 71, posY: 34 },
  { id: 'T27', name: 'ساحل شنجهاي وتوكيو المالي', type: 'coastal', resourceSpecialty: 'gold', resourceMultiplier: 2.0, posX: 84, posY: 36 },
  { id: 'T28', name: 'شبه الجزيرة الهندية', type: 'plain', resourceSpecialty: 'food', resourceMultiplier: 1.7, posX: 69, posY: 46 },
  { id: 'T29', name: 'جبال الهيمالايا العظمى', type: 'mountain', resourceSpecialty: 'gold', resourceMultiplier: 1.8, posX: 67, posY: 40 },
  { id: 'T30', name: 'ساحل الهند الصينية الاستوائي', type: 'coastal', resourceSpecialty: 'food', resourceMultiplier: 1.4, posX: 76, posY: 48 },
  { id: 'T31', name: 'جزر السند الساطعة (إندونيسيا)', type: 'coastal', resourceSpecialty: 'oil', resourceMultiplier: 1.5, posX: 80, posY: 58 },
  
  // Africa
  { id: 'T32', name: 'حقول النيجير الذهبية الأطلسية', type: 'coastal', resourceSpecialty: 'oil', resourceMultiplier: 1.7, posX: 36, posY: 60 },
  { id: 'T33', name: 'جبال كينيا الاستوائية', type: 'mountain', resourceSpecialty: 'food', resourceMultiplier: 1.5, posX: 48, posY: 62 },
  { id: 'T34', name: 'صحراء نفط ليفي (ليبيا)', type: 'desert', resourceSpecialty: 'oil', resourceMultiplier: 1.8, posX: 44, posY: 48 },
  { id: 'T35', name: 'مناجم الذهب في جنوب أفريقيا', type: 'coastal', resourceSpecialty: 'gold', resourceMultiplier: 2.0, posX: 46, posY: 80 },
  
  // Oceania
  { id: 'T36', name: 'الصحراء الأسترالية الغنية', type: 'desert', resourceSpecialty: 'iron', resourceMultiplier: 1.9, posX: 85, posY: 78 }
];

// World static events generator bank
export const WORLD_EVENT_TEMPLATES = [
  {
    title: 'أزمة كساد مالي عالمي',
    description: 'انهارت البورصة التجارية العالمية، مما قلل توليد الضرائب والذهب في جميع الدول بنسبة 25% لمدة ساعات.',
    type: 'crisis' as const,
    severity: 6,
    effect: 'انخفاض الدخل العام للذهب بنسبة 25%'
  },
  {
    title: 'اكتشاف آبار نفط صخرية جديدة',
    description: 'تفجّر نبع نفطي هائل في إحدى مناطق السهوب والمناطق القاحلة العشبية زاد من الإنتاج الإقليمي.',
    type: 'discovery' as const,
    severity: 8,
    effect: 'زيادة إيجاد النفط بنسبة 40% إضافية لجميع المستخرجات'
  },
  {
    title: 'عاصفة شمسية مدمرة للكهرباء',
    description: 'ضرب غلاف الأرض المغناطيسي جسيمات شمسية تسببت في قطع موقت للطاقة وتعطيل التكنولوجيا.',
    type: 'disaster' as const,
    severity: 7,
    effect: 'فقد مستمر لـ 50 وحدة طاقة كهربائية في الدول'
  },
  {
    title: 'طفرة خصوبة وحصاد استثنائي',
    description: 'أمطار وفيرة غمرت شرايين الأنهار الكبرى مسببة طفرة في المحاصيل الغذائية وراحة مجتمعية.',
    type: 'prosperity' as const,
    severity: 9,
    effect: 'مضاعفة إنتاج الغذاء وزيادة معدل التوظيف ورضا الشعب'
  }
];
