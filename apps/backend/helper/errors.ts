export const COMMON_ERRORS = {
  INTERNAL_SERVER_ERROR: "Internal server error",
  INVALID_REQUEST: "Invalid request payload or parameters",
  INVALID_DATA: "Invalid data provided",
  UNAUTHORIZED: "You are not authorized to perform this action",
} as const;

export const AUTH_ERRORS = {
  USER_NOT_FOUND: "User not found",
  USER_NOT_FOUND_PLEASE_SIGNUP: "User not found. Please sign up first",
  USER_ALREADY_EXISTS: "An account with this email already exists",
  INCORRECT_PASSWORD: "Incorrect password",
  SIGN_IN_WITH_GOOGLE_INSTEAD: "This account was created with Google. Please sign in with Google",
  INVALID_PROFILE: "Invalid profile data provided",
} as const;

export const ORG_ERRORS = {
  NOT_AUTHENTICATED_TO_CREATE_ORG: "You are not authorized to create or manage this organization",
  PLEASE_PROVIDE_ORGID: "Organization ID is required",
  UNAUTHORIZED_ONLY_SUPERADMIN_CAN_EDIT_WORKSPACE: "Only the workspace superadmin can edit workspace details",
  UNAUTHORIZED_ONLY_SUPERADMIN_CAN_DELETE_WORKSPACE: "Only the workspace superadmin can delete this workspace",
} as const;

export const MEMBER_ERRORS = {
  UNAUTHORIZED_ONLY_SUPERADMIN_CAN_INVITE: "Only the workspace superadmin can invite members",
  UNAUTHORIZED_ONLY_SUPERADMIN_CAN_CHANGE_ROLE: "Only the workspace superadmin can change member roles",
  UNAUTHORIZED_ONLY_SUPERADMIN_CAN_REMOVE_MEMBERS: "Only the workspace superadmin can remove members",
  ALREADY_WORKSPACE_MEMBER: "User is already a member of this workspace",
  ALREADY_ADDED: "User is already added to this organization",
  MEMBERSHIP_NOT_FOUND: "Membership not found in this organization",
  SUPERADMIN_ROLE_CANNOT_BE_CHANGED: "Superadmin role cannot be changed",
  CANNOT_CHANGE_OWN_ROLE: "You cannot change your own role",
  CANNOT_DEMOTE_LAST_ADMIN: "Cannot demote the last remaining administrator in this workspace",
  SUPERADMIN_CANNOT_BE_REMOVED: "Superadmin cannot be removed from the organization",
  CANNOT_REMOVE_SELF: "You cannot remove yourself from the organization",
  CANNOT_REMOVE_LAST_ADMIN: "Cannot remove the last remaining administrator in this workspace",
  INVALID_ROLE: "Invalid role specified",

  // Invitation
  INVITATION_ALREADY_SENT: "An invitation has already been sent to this email",
  INVITATION_NOT_FOUND: "Invitation not found",
  INVITATION_ACCEPTED_OR_DECLINED: "This invitation has already been accepted or declined",

  // Board access assignments for members
  INVALID_BOARD_ASSIGNMENT: "One or more specified boards are invalid for this workspace",
  CANNOT_CHANGE_OWN_BOARD_ACCESS: "You cannot modify your own board access",
  BOARD_ASSIGNMENTS_ONLY_APPLY_TO_MEMBERS: "Board access assignments only apply to regular members",
} as const;

export const BOARD_ERRORS = {
  PLEASE_PROVIDE_BOARD_ID: "Board ID is required",
  BOARD_NOT_FOUND: "Board not found",
} as const;

export const SECTION_ERRORS = {
  PLEASE_PROVIDE_SECTION_ID: "Section ID is required",
  SECTION_NOT_FOUND: "Section not found",
} as const;

export const ISSUE_ERRORS = {
  ISSUE_NOT_FOUND: "Card/Issue not found",
} as const;

export const COMMENT_ERRORS = {
  COMMENT_NOT_FOUND: "Comment not found",
  NOT_COMMENT_AUTHOR: "You can only edit or delete your own comments",
} as const;

// Combined dictionary for global access
export const ERRORS = {
  ...COMMON_ERRORS,
  ...AUTH_ERRORS,
  ...ORG_ERRORS,
  ...MEMBER_ERRORS,
  ...BOARD_ERRORS,
  ...SECTION_ERRORS,
  ...ISSUE_ERRORS,
  ...COMMENT_ERRORS,
} as const;

export const ERROR_KEYS = ERRORS;
export type ErrorKey = keyof typeof ERRORS;
