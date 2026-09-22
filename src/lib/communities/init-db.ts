import Database from "better-sqlite3";

export function ensureCommunityTablesExist(dbPath: string) {
  try {
    const sqlite = new Database(dbPath);
    
    // Check if CommunityMember table already exists
    const row = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='CommunityMember'").get();
    if (row) {
      sqlite.close();
      return;
    }

    console.log("[DB-INIT] CommunityMember table missing in", dbPath, "- running schema migration...");

    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS "Community" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "slug" TEXT,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "avatarUrl" TEXT,
          "coverUrl" TEXT,
          "type" TEXT NOT NULL DEFAULT 'CUSTOM',
          "discoverability" TEXT NOT NULL DEFAULT 'MEMBERS_ONLY',
          "joinMethod" TEXT NOT NULL DEFAULT 'INVITE_LINK',
          "joinCode" TEXT,
          "memberListVisibility" TEXT NOT NULL DEFAULT 'EVERYONE',
          "invitePermission" TEXT NOT NULL DEFAULT 'ALL_MEMBERS',
          "channelCreatePermission" TEXT NOT NULL DEFAULT 'ADMINS',
          "callStartPermission" TEXT NOT NULL DEFAULT 'MEMBERS',
          "isTemporary" BOOLEAN NOT NULL DEFAULT false,
          "startDate" DATETIME,
          "endDate" DATETIME,
          "archivedAt" DATETIME,
          "archiveReason" TEXT,
          "ownerId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Community_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityModule" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "moduleKey" TEXT NOT NULL,
          "isEnabled" BOOLEAN NOT NULL DEFAULT true,
          "settings" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "CommunityModule_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityRole" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "icon" TEXT,
          "color" TEXT,
          "isSystem" BOOLEAN NOT NULL DEFAULT false,
          "systemType" TEXT,
          "priority" INTEGER NOT NULL DEFAULT 10,
          "canSendMessages" BOOLEAN NOT NULL DEFAULT true,
          "canDeleteMessages" BOOLEAN NOT NULL DEFAULT false,
          "canAddMembers" BOOLEAN NOT NULL DEFAULT false,
          "canRemoveMembers" BOOLEAN NOT NULL DEFAULT false,
          "canInviteMembers" BOOLEAN NOT NULL DEFAULT true,
          "canCreateChannels" BOOLEAN NOT NULL DEFAULT false,
          "canManageCommunity" BOOLEAN NOT NULL DEFAULT false,
          "canCreateEvents" BOOLEAN NOT NULL DEFAULT false,
          "canManageEvents" BOOLEAN NOT NULL DEFAULT false,
          "canCreatePolls" BOOLEAN NOT NULL DEFAULT true,
          "canUploadFiles" BOOLEAN NOT NULL DEFAULT true,
          "canDeleteFiles" BOOLEAN NOT NULL DEFAULT false,
          "canStartCalls" BOOLEAN NOT NULL DEFAULT true,
          "canAssignRoles" BOOLEAN NOT NULL DEFAULT false,
          "canCreateAnnouncements" BOOLEAN NOT NULL DEFAULT false,
          "canModerateContent" BOOLEAN NOT NULL DEFAULT false,
          "canManageModules" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "CommunityRole_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityMember" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "roleId" TEXT NOT NULL,
          "nickname" TEXT,
          "title" TEXT,
          "department" TEXT,
          "teamNumber" INTEGER,
          "position" TEXT,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "invitedById" TEXT,
          "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "CommunityRole" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityChannel" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "icon" TEXT,
          "type" TEXT NOT NULL DEFAULT 'PUBLIC',
          "allowedRoleIds" TEXT,
          "isAnnouncementOnly" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "CommunityChannel_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityChannelMessage" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "channelId" TEXT NOT NULL,
          "senderId" TEXT NOT NULL,
          "ciphertext" TEXT NOT NULL,
          "iv" TEXT NOT NULL,
          "keyEpoch" INTEGER NOT NULL DEFAULT 1,
          "type" TEXT NOT NULL DEFAULT 'TEXT',
          "metadata" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CommunityChannelMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CommunityChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityChannelMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityInvite" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "token" TEXT NOT NULL,
          "assignedRoleId" TEXT,
          "maxUses" INTEGER,
          "usedCount" INTEGER NOT NULL DEFAULT 0,
          "expiresAt" DATETIME,
          "isRevoked" BOOLEAN NOT NULL DEFAULT false,
          "createdById" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CommunityInvite_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityJoinRequest" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "requestedRoleId" TEXT,
          "note" TEXT,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "reviewedById" TEXT,
          "reviewedAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CommunityJoinRequest_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityAnnouncement" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "authorId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "mediaUrl" TEXT,
          "isPinned" BOOLEAN NOT NULL DEFAULT false,
          "notifyAll" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "CommunityAnnouncement_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityAnnouncement_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityEvent" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "creatorId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "location" TEXT,
          "startDate" DATETIME NOT NULL,
          "endDate" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "CommunityEvent_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityEvent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityEventRsvp" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "eventId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'GOING',
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "CommunityEventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CommunityEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityEventRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityPoll" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "question" TEXT NOT NULL,
          "isMultiple" BOOLEAN NOT NULL DEFAULT false,
          "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
          "closesAt" DATETIME,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CommunityPoll_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityPollOption" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "pollId" TEXT NOT NULL,
          "text" TEXT NOT NULL,
          CONSTRAINT "CommunityPollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "CommunityPoll" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityPollVote" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "pollId" TEXT NOT NULL,
          "optionId" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CommunityPollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "CommunityPoll" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityPollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "CommunityPollOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityPollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityFile" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "sizeBytes" INTEGER NOT NULL,
          "mimeType" TEXT NOT NULL,
          "fileUrl" TEXT NOT NULL,
          "uploaderId" TEXT NOT NULL,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "CommunityFile_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "CommunityCryptoState" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "communityId" TEXT NOT NULL,
          "channelId" TEXT NOT NULL,
          "keyEpoch" INTEGER NOT NULL DEFAULT 1,
          "encryptedKeyEnvelopes" TEXT NOT NULL,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "CommunityCryptoState_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "CommunityCryptoState_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CommunityChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );

      CREATE UNIQUE INDEX IF NOT EXISTS "Community_slug_key" ON "Community"("slug");
      CREATE INDEX IF NOT EXISTS "Community_ownerId_idx" ON "Community"("ownerId");
      CREATE INDEX IF NOT EXISTS "Community_type_idx" ON "Community"("type");
      CREATE UNIQUE INDEX IF NOT EXISTS "CommunityModule_communityId_moduleKey_key" ON "CommunityModule"("communityId", "moduleKey");
      CREATE INDEX IF NOT EXISTS "CommunityRole_communityId_idx" ON "CommunityRole"("communityId");
      CREATE INDEX IF NOT EXISTS "CommunityMember_communityId_idx" ON "CommunityMember"("communityId");
      CREATE INDEX IF NOT EXISTS "CommunityMember_userId_idx" ON "CommunityMember"("userId");
      CREATE UNIQUE INDEX IF NOT EXISTS "CommunityMember_communityId_userId_key" ON "CommunityMember"("communityId", "userId");
      CREATE INDEX IF NOT EXISTS "CommunityChannel_communityId_idx" ON "CommunityChannel"("communityId");
      CREATE INDEX IF NOT EXISTS "CommunityChannelMessage_channelId_idx" ON "CommunityChannelMessage"("channelId");
      CREATE INDEX IF NOT EXISTS "CommunityChannelMessage_senderId_idx" ON "CommunityChannelMessage"("senderId");
      CREATE UNIQUE INDEX IF NOT EXISTS "CommunityInvite_token_key" ON "CommunityInvite"("token");
      CREATE INDEX IF NOT EXISTS "CommunityInvite_token_idx" ON "CommunityInvite"("token");
      CREATE INDEX IF NOT EXISTS "CommunityInvite_communityId_idx" ON "CommunityInvite"("communityId");
      CREATE INDEX IF NOT EXISTS "CommunityJoinRequest_communityId_idx" ON "CommunityJoinRequest"("communityId");
      CREATE UNIQUE INDEX IF NOT EXISTS "CommunityJoinRequest_communityId_userId_key" ON "CommunityJoinRequest"("communityId", "userId");
      CREATE INDEX IF NOT EXISTS "CommunityAnnouncement_communityId_idx" ON "CommunityAnnouncement"("communityId");
      CREATE INDEX IF NOT EXISTS "CommunityEvent_communityId_idx" ON "CommunityEvent"("communityId");
      CREATE INDEX IF NOT EXISTS "CommunityEventRsvp_eventId_idx" ON "CommunityEventRsvp"("eventId");
      CREATE UNIQUE INDEX IF NOT EXISTS "CommunityEventRsvp_eventId_userId_key" ON "CommunityEventRsvp"("eventId", "userId");
      CREATE INDEX IF NOT EXISTS "CommunityPoll_communityId_idx" ON "CommunityPoll"("communityId");
      CREATE INDEX IF NOT EXISTS "CommunityPollOption_pollId_idx" ON "CommunityPollOption"("pollId");
      CREATE INDEX IF NOT EXISTS "CommunityPollVote_pollId_idx" ON "CommunityPollVote"("pollId");
      CREATE UNIQUE INDEX IF NOT EXISTS "CommunityPollVote_pollId_optionId_userId_key" ON "CommunityPollVote"("pollId", "optionId", "userId");
      CREATE INDEX IF NOT EXISTS "CommunityFile_communityId_idx" ON "CommunityFile"("communityId");
      CREATE INDEX IF NOT EXISTS "CommunityCryptoState_communityId_idx" ON "CommunityCryptoState"("communityId");
      CREATE UNIQUE INDEX IF NOT EXISTS "CommunityCryptoState_channelId_keyEpoch_key" ON "CommunityCryptoState"("channelId", "keyEpoch");
    `);

    console.log("[DB-INIT] All Community tables confirmed in", dbPath);
    sqlite.close();
  } catch (err) {
    console.error("[DB-INIT] Failed to ensure community tables:", err);
  }
}
