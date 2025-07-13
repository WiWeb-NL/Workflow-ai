import { relations } from "drizzle-orm/relations";
import { user, workflowFolder, workspace, account, environment, copilotChats, workflow, invitation, organization, apiKey, chat, customTools, knowledgeBase, marketplace, member, permissions, session, settings, userStats, workspaceInvitation, workspaceMember, document, embedding, memory, webhook, workflowBlocks, workflowEdges, workflowExecutionBlocks, workflowExecutionSnapshots, workflowExecutionLogs, workflowLogs, workflowSchedule, workflowSubflows } from "./schema";

export const workflowFolderRelations = relations(workflowFolder, ({one, many}) => ({
	user: one(user, {
		fields: [workflowFolder.userId],
		references: [user.id]
	}),
	workspace: one(workspace, {
		fields: [workflowFolder.workspaceId],
		references: [workspace.id]
	}),
	workflows: many(workflow),
}));

export const userRelations = relations(user, ({many}) => ({
	workflowFolders: many(workflowFolder),
	accounts: many(account),
	workspaces: many(workspace),
	environments: many(environment),
	copilotChats: many(copilotChats),
	invitations: many(invitation),
	apiKeys: many(apiKey),
	chats: many(chat),
	customTools: many(customTools),
	knowledgeBases: many(knowledgeBase),
	marketplaces: many(marketplace),
	members: many(member),
	permissions: many(permissions),
	sessions: many(session),
	settings: many(settings),
	userStats: many(userStats),
	workflows: many(workflow),
	workspaceInvitations: many(workspaceInvitation),
	workspaceMembers: many(workspaceMember),
}));

export const workspaceRelations = relations(workspace, ({one, many}) => ({
	workflowFolders: many(workflowFolder),
	user: one(user, {
		fields: [workspace.ownerId],
		references: [user.id]
	}),
	knowledgeBases: many(knowledgeBase),
	workflows: many(workflow),
	workspaceInvitations: many(workspaceInvitation),
	workspaceMembers: many(workspaceMember),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const environmentRelations = relations(environment, ({one}) => ({
	user: one(user, {
		fields: [environment.userId],
		references: [user.id]
	}),
}));

export const copilotChatsRelations = relations(copilotChats, ({one}) => ({
	user: one(user, {
		fields: [copilotChats.userId],
		references: [user.id]
	}),
	workflow: one(workflow, {
		fields: [copilotChats.workflowId],
		references: [workflow.id]
	}),
}));

export const workflowRelations = relations(workflow, ({one, many}) => ({
	copilotChats: many(copilotChats),
	chats: many(chat),
	marketplaces: many(marketplace),
	workflowFolder: one(workflowFolder, {
		fields: [workflow.folderId],
		references: [workflowFolder.id]
	}),
	user: one(user, {
		fields: [workflow.userId],
		references: [user.id]
	}),
	workspace: one(workspace, {
		fields: [workflow.workspaceId],
		references: [workspace.id]
	}),
	memories: many(memory),
	webhooks: many(webhook),
	workflowBlocks: many(workflowBlocks),
	workflowEdges: many(workflowEdges),
	workflowExecutionBlocks: many(workflowExecutionBlocks),
	workflowExecutionLogs: many(workflowExecutionLogs),
	workflowExecutionSnapshots: many(workflowExecutionSnapshots),
	workflowLogs: many(workflowLogs),
	workflowSchedules: many(workflowSchedule),
	workflowSubflows: many(workflowSubflows),
}));

export const invitationRelations = relations(invitation, ({one}) => ({
	user: one(user, {
		fields: [invitation.inviterId],
		references: [user.id]
	}),
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id]
	}),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	invitations: many(invitation),
	members: many(member),
	sessions: many(session),
}));

export const apiKeyRelations = relations(apiKey, ({one}) => ({
	user: one(user, {
		fields: [apiKey.userId],
		references: [user.id]
	}),
}));

export const chatRelations = relations(chat, ({one}) => ({
	user: one(user, {
		fields: [chat.userId],
		references: [user.id]
	}),
	workflow: one(workflow, {
		fields: [chat.workflowId],
		references: [workflow.id]
	}),
}));

export const customToolsRelations = relations(customTools, ({one}) => ({
	user: one(user, {
		fields: [customTools.userId],
		references: [user.id]
	}),
}));

export const knowledgeBaseRelations = relations(knowledgeBase, ({one, many}) => ({
	user: one(user, {
		fields: [knowledgeBase.userId],
		references: [user.id]
	}),
	workspace: one(workspace, {
		fields: [knowledgeBase.workspaceId],
		references: [workspace.id]
	}),
	documents: many(document),
	embeddings: many(embedding),
}));

export const marketplaceRelations = relations(marketplace, ({one}) => ({
	user: one(user, {
		fields: [marketplace.authorId],
		references: [user.id]
	}),
	workflow: one(workflow, {
		fields: [marketplace.workflowId],
		references: [workflow.id]
	}),
}));

export const memberRelations = relations(member, ({one}) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id]
	}),
}));

export const permissionsRelations = relations(permissions, ({one}) => ({
	user: one(user, {
		fields: [permissions.userId],
		references: [user.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	organization: one(organization, {
		fields: [session.activeOrganizationId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const settingsRelations = relations(settings, ({one}) => ({
	user: one(user, {
		fields: [settings.userId],
		references: [user.id]
	}),
}));

export const userStatsRelations = relations(userStats, ({one}) => ({
	user: one(user, {
		fields: [userStats.userId],
		references: [user.id]
	}),
}));

export const workspaceInvitationRelations = relations(workspaceInvitation, ({one}) => ({
	user: one(user, {
		fields: [workspaceInvitation.inviterId],
		references: [user.id]
	}),
	workspace: one(workspace, {
		fields: [workspaceInvitation.workspaceId],
		references: [workspace.id]
	}),
}));

export const workspaceMemberRelations = relations(workspaceMember, ({one}) => ({
	user: one(user, {
		fields: [workspaceMember.userId],
		references: [user.id]
	}),
	workspace: one(workspace, {
		fields: [workspaceMember.workspaceId],
		references: [workspace.id]
	}),
}));

export const documentRelations = relations(document, ({one, many}) => ({
	knowledgeBase: one(knowledgeBase, {
		fields: [document.knowledgeBaseId],
		references: [knowledgeBase.id]
	}),
	embeddings: many(embedding),
}));

export const embeddingRelations = relations(embedding, ({one}) => ({
	document: one(document, {
		fields: [embedding.documentId],
		references: [document.id]
	}),
	knowledgeBase: one(knowledgeBase, {
		fields: [embedding.knowledgeBaseId],
		references: [knowledgeBase.id]
	}),
}));

export const memoryRelations = relations(memory, ({one}) => ({
	workflow: one(workflow, {
		fields: [memory.workflowId],
		references: [workflow.id]
	}),
}));

export const webhookRelations = relations(webhook, ({one}) => ({
	workflow: one(workflow, {
		fields: [webhook.workflowId],
		references: [workflow.id]
	}),
}));

export const workflowBlocksRelations = relations(workflowBlocks, ({one, many}) => ({
	workflow: one(workflow, {
		fields: [workflowBlocks.workflowId],
		references: [workflow.id]
	}),
	workflowEdges_sourceBlockId: many(workflowEdges, {
		relationName: "workflowEdges_sourceBlockId_workflowBlocks_id"
	}),
	workflowEdges_targetBlockId: many(workflowEdges, {
		relationName: "workflowEdges_targetBlockId_workflowBlocks_id"
	}),
}));

export const workflowEdgesRelations = relations(workflowEdges, ({one}) => ({
	workflowBlock_sourceBlockId: one(workflowBlocks, {
		fields: [workflowEdges.sourceBlockId],
		references: [workflowBlocks.id],
		relationName: "workflowEdges_sourceBlockId_workflowBlocks_id"
	}),
	workflowBlock_targetBlockId: one(workflowBlocks, {
		fields: [workflowEdges.targetBlockId],
		references: [workflowBlocks.id],
		relationName: "workflowEdges_targetBlockId_workflowBlocks_id"
	}),
	workflow: one(workflow, {
		fields: [workflowEdges.workflowId],
		references: [workflow.id]
	}),
}));

export const workflowExecutionBlocksRelations = relations(workflowExecutionBlocks, ({one}) => ({
	workflow: one(workflow, {
		fields: [workflowExecutionBlocks.workflowId],
		references: [workflow.id]
	}),
}));

export const workflowExecutionLogsRelations = relations(workflowExecutionLogs, ({one}) => ({
	workflowExecutionSnapshot: one(workflowExecutionSnapshots, {
		fields: [workflowExecutionLogs.stateSnapshotId],
		references: [workflowExecutionSnapshots.id]
	}),
	workflow: one(workflow, {
		fields: [workflowExecutionLogs.workflowId],
		references: [workflow.id]
	}),
}));

export const workflowExecutionSnapshotsRelations = relations(workflowExecutionSnapshots, ({one, many}) => ({
	workflowExecutionLogs: many(workflowExecutionLogs),
	workflow: one(workflow, {
		fields: [workflowExecutionSnapshots.workflowId],
		references: [workflow.id]
	}),
}));

export const workflowLogsRelations = relations(workflowLogs, ({one}) => ({
	workflow: one(workflow, {
		fields: [workflowLogs.workflowId],
		references: [workflow.id]
	}),
}));

export const workflowScheduleRelations = relations(workflowSchedule, ({one}) => ({
	workflow: one(workflow, {
		fields: [workflowSchedule.workflowId],
		references: [workflow.id]
	}),
}));

export const workflowSubflowsRelations = relations(workflowSubflows, ({one}) => ({
	workflow: one(workflow, {
		fields: [workflowSubflows.workflowId],
		references: [workflow.id]
	}),
}));