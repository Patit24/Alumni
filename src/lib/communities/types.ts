export type CommunityType =
  | "EDUCATION"
  | "ORGANIZATION"
  | "SPORTS"
  | "GAMING"
  | "CLUB"
  | "NGO"
  | "EVENT"
  | "FRIENDS"
  | "PRIVATE"
  | "CUSTOM";

export type CommunityPermission =
  | "SEND_MESSAGES"
  | "DELETE_MESSAGES"
  | "ADD_MEMBERS"
  | "REMOVE_MEMBERS"
  | "INVITE_MEMBERS"
  | "CREATE_CHANNELS"
  | "MANAGE_COMMUNITY"
  | "CREATE_EVENTS"
  | "MANAGE_EVENTS"
  | "CREATE_POLLS"
  | "UPLOAD_FILES"
  | "DELETE_FILES"
  | "START_CALLS"
  | "ASSIGN_ROLES"
  | "CREATE_ANNOUNCEMENTS"
  | "MODERATE_CONTENT"
  | "MANAGE_MODULES";

export type CommunityModuleKey =
  | "CHANNELS"
  | "ANNOUNCEMENTS"
  | "EVENTS"
  | "POLLS"
  | "FILES"
  | "CALLS"
  | "SPORTS_FIXTURES"
  | "PROJECTS";

export interface CommunityTemplate {
  type: CommunityType;
  name: string;
  icon: string; // Lucide icon identifier or emoji
  emoji: string;
  tagline: string;
  description: string;
  accentColor: string;
  coverPreset: string;
  recommendedModules: CommunityModuleKey[];
  defaultChannels: Array<{
    name: string;
    description: string;
    type?: "PUBLIC" | "PRIVATE" | "ROLE_RESTRICTED";
    icon?: string;
  }>;
  defaultRoles: Array<{
    name: string;
    systemType: "OWNER" | "ADMIN" | "MODERATOR" | "MANAGER" | "MEMBER" | "GUEST";
    priority: number;
    color: string;
    permissions: Partial<Record<CommunityPermission, boolean>>;
  }>;
}
