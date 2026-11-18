import type { LucideIcon } from "lucide-react";
import { Award, Globe, Heart, Target, Users, Zap } from "lucide-react";
import type { HomepageCmsMap } from "@/lib/homepage-cms";
import { cmsText } from "@/lib/homepage-cms";

export const MAX_ABOUT_VALUES = 6;
export const MAX_ABOUT_MISSION_HIGHLIGHTS = 3;
export const MAX_ABOUT_MILESTONES = 6;

export const ABOUT_VALUE_ICONS: LucideIcon[] = [Target, Zap, Users, Globe, Award, Heart];
export const ABOUT_MISSION_ICONS: LucideIcon[] = [Zap, Target, Users];

export interface AboutValueItem {
  title: string;
  desc: string;
}

export interface AboutMissionHighlight {
  title: string;
  desc: string;
}

export interface AboutMilestone {
  year: string;
  title: string;
  desc: string;
}

function valueKeys(index: number) {
  return {
    title: `about.value${index}_title`,
    desc: `about.value${index}_desc`,
  } as const;
}

function missionHighlightKeys(index: number) {
  return {
    title: `about.mission_highlight${index}_title`,
    desc: `about.mission_highlight${index}_desc`,
  } as const;
}

function milestoneKeys(index: number) {
  return {
    year: `about.milestone${index}_year`,
    title: `about.milestone${index}_title`,
    desc: `about.milestone${index}_desc`,
  } as const;
}

export function parseAboutValues(cms: HomepageCmsMap): AboutValueItem[] {
  return Array.from({ length: MAX_ABOUT_VALUES }, (_, i) => i + 1)
    .map((index) => {
      const keys = valueKeys(index);
      return {
        title: cmsText(cms, keys.title),
        desc: cmsText(cms, keys.desc),
      };
    })
    .filter((item) => item.title.trim());
}

export function parseAboutMissionHighlights(cms: HomepageCmsMap): AboutMissionHighlight[] {
  return Array.from({ length: MAX_ABOUT_MISSION_HIGHLIGHTS }, (_, i) => i + 1)
    .map((index) => {
      const keys = missionHighlightKeys(index);
      return {
        title: cmsText(cms, keys.title),
        desc: cmsText(cms, keys.desc),
      };
    })
    .filter((item) => item.title.trim());
}

export function parseAboutMilestones(cms: HomepageCmsMap): AboutMilestone[] {
  return Array.from({ length: MAX_ABOUT_MILESTONES }, (_, i) => i + 1)
    .map((index) => {
      const keys = milestoneKeys(index);
      return {
        year: cmsText(cms, keys.year),
        title: cmsText(cms, keys.title),
        desc: cmsText(cms, keys.desc),
      };
    })
    .filter((item) => item.title.trim() && item.year.trim());
}

export { valueKeys, missionHighlightKeys, milestoneKeys };