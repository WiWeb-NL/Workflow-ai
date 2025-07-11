import { render } from '@react-email/components'
import { BatchInvitationEmail } from './batch-invitation-email'
import { InvitationEmail } from './invitation-email'
import { OTPVerificationEmail } from './otp-verification-email'
import { ResetPasswordEmail } from './reset-password-email'

export async function renderOTPEmail(
  otp: string,
  email: string,
  type: 'sign-in' | 'email-verification' | 'forget-password' = 'email-verification',
  chatTitle?: string
): Promise<string> {
  return await render(OTPVerificationEmail({ otp, email, type, chatTitle }))
}

export async function renderPasswordResetEmail(
  username: string,
  resetLink: string
): Promise<string> {
  return await render(
    ResetPasswordEmail({ username, resetLink: resetLink, updatedDate: new Date() })
  )
}

export async function renderInvitationEmail(
  inviterName: string,
  organizationName: string,
  invitationUrl: string,
  email: string
): Promise<string> {
  return await render(
    InvitationEmail({
      inviterName,
      organizationName,
      inviteLink: invitationUrl,
      invitedEmail: email,
      updatedDate: new Date(),
    })
  )
}

interface WorkspaceInvitation {
  workspaceId: string
  workspaceName: string
  permission: 'admin' | 'write' | 'read'
}

export async function renderBatchInvitationEmail(
  inviterName: string,
  organizationName: string,
  organizationRole: 'admin' | 'member',
  workspaceInvitations: WorkspaceInvitation[],
  acceptUrl: string
): Promise<string> {
  return await render(
    BatchInvitationEmail({
      inviterName,
      organizationName,
      organizationRole,
      workspaceInvitations,
      acceptUrl,
    })
  )
}

export function getEmailSubject(
  type:
    | 'sign-in'
    | 'email-verification'
    | 'forget-password'
    | 'reset-password'
    | 'invitation'
    | 'batch-invitation'
): string {
  switch (type) {
    case 'sign-in':
      return 'Sign in to Visual Workflow AI'
    case 'email-verification':
      return 'Verify your email for Visual Workflow AI'
    case 'forget-password':
      return 'Reset your Visual Workflow AI password'
    case 'reset-password':
      return 'Reset your Visual Workflow AI password'
    case 'invitation':
      return "You've been invited to join a team on Visual Workflow AI"
    case 'batch-invitation':
      return "You've been invited to join a team and workspaces on Visual Workflow AI"
    default:
      return 'Visual Workflow AI'
  }
}
