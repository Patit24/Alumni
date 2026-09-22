import { CommunityPermission } from "./types";

export interface MemberWithRole {
  id?: string;
  userId: string;
  communityId?: string;
  status: string; // "ACTIVE" | "MUTED" | "BANNED"
  role: {
    id: string;
    systemType?: string | null;
    priority?: number;
    canSendMessages: boolean;
    canDeleteMessages: boolean;
    canAddMembers: boolean;
    canRemoveMembers: boolean;
    canInviteMembers: boolean;
    canCreateChannels: boolean;
    canManageCommunity: boolean;
    canCreateEvents: boolean;
    canManageEvents: boolean;
    canCreatePolls: boolean;
    canUploadFiles: boolean;
    canDeleteFiles: boolean;
    canStartCalls: boolean;
    canAssignRoles: boolean;
    canCreateAnnouncements: boolean;
    canModerateContent: boolean;
    canManageModules: boolean;
  };
}

export interface CommunityContext {
  id: string;
  ownerId: string;
  invitePermission?: string;
  channelCreatePermission?: string;
  callStartPermission?: string;
  archivedAt?: Date | string | null;
}

export interface ChannelContext {
  id: string;
  type: string; // "PUBLIC" | "PRIVATE" | "ROLE_RESTRICTED"
  allowedRoleIds?: string | null; // JSON string array
  isAnnouncementOnly?: boolean;
}

const PERMISSION_FIELD_MAP: Record<CommunityPermission, keyof MemberWithRole["role"]> = {
  SEND_MESSAGES: "canSendMessages",
  DELETE_MESSAGES: "canDeleteMessages",
  ADD_MEMBERS: "canAddMembers",
  REMOVE_MEMBERS: "canRemoveMembers",
  INVITE_MEMBERS: "canInviteMembers",
  CREATE_CHANNELS: "canCreateChannels",
  MANAGE_COMMUNITY: "canManageCommunity",
  CREATE_EVENTS: "canCreateEvents",
  MANAGE_EVENTS: "canManageEvents",
  CREATE_POLLS: "canCreatePolls",
  UPLOAD_FILES: "canUploadFiles",
  DELETE_FILES: "canDeleteFiles",
  START_CALLS: "canStartCalls",
  ASSIGN_ROLES: "canAssignRoles",
  CREATE_ANNOUNCEMENTS: "canCreateAnnouncements",
  MODERATE_CONTENT: "canModerateContent",
  MANAGE_MODULES: "canManageModules",
};

/**
 * Centralized authorization engine: verifies if a member can perform a given action
 */
export function can(
  member: MemberWithRole | null | undefined,
  action: CommunityPermission,
  community: CommunityContext,
  channel?: ChannelContext
): boolean {
  if (!member) return false;

  // 1. Community owner has full access unless community is archived (for mutating actions)
  const isOwner = member.userId === community.ownerId;
  if (isOwner) {
    if (community.archivedAt && action !== "MANAGE_COMMUNITY") {
      return false; // Archived communities are read-only
    }
    return true;
  }

  // 2. Archived communities cannot be modified by non-owners
  if (community.archivedAt) {
    return false;
  }

  // 3. Status checks
  if (member.status === "BANNED") return false;
  if (member.status === "MUTED" && (action === "SEND_MESSAGES" || action === "START_CALLS")) {
    return false;
  }

  // 4. Channel-level permission checks
  if (channel) {
    if (channel.type === "ROLE_RESTRICTED" && channel.allowedRoleIds) {
      try {
        const allowed: string[] = JSON.parse(channel.allowedRoleIds);
        if (Array.isArray(allowed) && !allowed.includes(member.role.id)) {
          return false;
        }
      } catch {
        // failed parse
      }
    }

    if (channel.isAnnouncementOnly && action === "SEND_MESSAGES") {
      // Only admins/moderators can send messages in announcement-only channels
      return member.role.canCreateAnnouncements || member.role.canManageCommunity;
    }
  }

  // 5. Check Community-level permission overrides
  if (action === "INVITE_MEMBERS" && community.invitePermission) {
    if (community.invitePermission === "OWNER_ONLY") return isOwner;
    if (community.invitePermission === "ADMINS") return !!member.role.canManageCommunity;
  }

  if (action === "CREATE_CHANNELS" && community.channelCreatePermission) {
    if (community.channelCreatePermission === "OWNER_ONLY") return isOwner;
    if (community.channelCreatePermission === "ADMINS") return !!member.role.canManageCommunity;
  }

  if (action === "START_CALLS" && community.callStartPermission) {
    if (community.callStartPermission === "OWNER_ONLY") return isOwner;
    if (community.callStartPermission === "ADMINS") return !!member.role.canManageCommunity;
  }

  // 6. Role-level permission lookup
  const field = PERMISSION_FIELD_MAP[action];
  if (!field) return false;

  return Boolean(member.role[field]);
}

/**
 * Returns a complete boolean permission dictionary for client UI states
 */
export function getMemberPermissions(
  member: MemberWithRole | null | undefined,
  community: CommunityContext,
  channel?: ChannelContext
): Record<CommunityPermission, boolean> {
  const actions: CommunityPermission[] = [
    "SEND_MESSAGES",
    "DELETE_MESSAGES",
    "ADD_MEMBERS",
    "REMOVE_MEMBERS",
    "INVITE_MEMBERS",
    "CREATE_CHANNELS",
    "MANAGE_COMMUNITY",
    "CREATE_EVENTS",
    "MANAGE_EVENTS",
    "CREATE_POLLS",
    "UPLOAD_FILES",
    "DELETE_FILES",
    "START_CALLS",
    "ASSIGN_ROLES",
    "CREATE_ANNOUNCEMENTS",
    "MODERATE_CONTENT",
    "MANAGE_MODULES",
  ];

  const result: Partial<Record<CommunityPermission, boolean>> = {};
  for (const act of actions) {
    result[act] = can(member, act, community, channel);
  }
  return result as Record<CommunityPermission, boolean>;
}
