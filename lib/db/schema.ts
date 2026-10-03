import {
  type AnyPgColumn,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const userRoleEnum = pgEnum("user_role", ["admin", "hr_manager", "employee"])

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    code: text("code"),
    contactEmail: text("contact_email"),
    description: text("description"),
    externalKey: text("external_key"),
    plannedHeadcount: integer("planned_headcount"),
    isArchived: boolean("is_archived").notNull().default(false),
    headUserId: uuid("head_user_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => departments.id, { onDelete: "set null" }),
    regulationsDocId: uuid("regulations_doc_id").references((): AnyPgColumn => documents.id, {
      onDelete: "set null",
    }),
    standardsDocId: uuid("standards_doc_id").references((): AnyPgColumn => documents.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("departments_external_key_unique")
      .on(table.externalKey)
      .where(sql`${table.externalKey} is not null`),
  ]
)

export const orgImportRuns = pgTable("org_import_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  fileName: text("file_name"),
  syncMode: text("sync_mode").notNull().default("merge"),
  applyDepartments: boolean("apply_departments").notNull().default(false),
  applyEmployees: boolean("apply_employees").notNull().default(false),
  stats: text("stats"),
  warningsCount: integer("warnings_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  role: userRoleEnum("role").notNull().default("employee"),
  departmentId: uuid("department_id").references((): AnyPgColumn => departments.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const employeeProfiles = pgTable("employee_profiles", {
  userId: uuid("user_id")
    .notNull()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone"),
  middleName: text("middle_name"),
  avatarUrl: text("avatar_url"),
  positionTitle: text("position_title"),
  office: text("office"),
  birthDate: date("birth_date"),
  startDate: date("start_date"),
  welcomeNote: text("welcome_note"),
  presence: text("presence").notNull().default("office"),
  inn: text("inn"),
  snils: text("snils"),
  address: text("address"),
  citizenship: text("citizenship"),
  anniversaryYears: integer("anniversary_years"),
  professions: text("professions"),
  education: text("education"),
  managerPosition: text("manager_position"),
  contractEndDate: date("contract_end_date"),
  isContractor: boolean("is_contractor").notNull().default(false),
  annualLeaveDays: integer("annual_leave_days").notNull().default(28),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  version: text("version").notNull().default("1.0"),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  filePath: text("file_path"),
  access: text("access").notNull().default("public"),
  departmentId: text("department_id"),
  docType: text("doc_type").notNull().default("general"),
  linkedPosition: text("linked_position"),
  linkedDepartmentId: uuid("linked_department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  ownerLabel: text("owner_label"),
  // Статус актуальности для ассистента: draft | actual | archived | excluded.
  // В индекс попадают только actual (явная публикация).
  ragStatus: text("rag_status").notNull().default("draft"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const news = pgTable("news", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  category: text("category").notNull().default("company"),
  coverUrl: text("cover_url"),
  isPinned: boolean("is_pinned").notNull().default(false),
  status: text("status").notNull().default("draft"),
  authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const vacations = pgTable("vacations", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  daysTotal: integer("days_total").notNull(),
  daysRemaining: integer("days_remaining").notNull(),
  status: text("status").notNull().default("approved"),
  type: text("type").notNull().default("annual"),
  comment: text("comment"),
  approvedBy: uuid("approved_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const vacationApprovals = pgTable(
  "vacation_approvals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    vacationId: uuid("vacation_id")
      .notNull()
      .references(() => vacations.id, { onDelete: "cascade" }),
    step: text("step").notNull(),
    approverId: uuid("approver_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    comment: text("comment"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("vacation_approvals_vacation_idx").on(table.vacationId, table.createdAt)]
)

export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  metadata: text("metadata"),
  statusCode: integer("status_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: text("category").notNull().default("it"),
  subject: text("subject").notNull(),
  description: text("description"),
  status: text("status").notNull().default("new"),
  priority: text("priority").notNull().default("medium"),
  assigneeId: uuid("assignee_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  firstRespondedAt: timestamp("first_responded_at", { withTimezone: true }),
  slaBreached: boolean("sla_breached").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const ticketCategories = pgTable("ticket_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const ticketComments = pgTable(
  "ticket_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ticket_comments_ticket_idx").on(table.ticketId, table.createdAt)]
)

export const ticketAttachments = pgTable(
  "ticket_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    uploadedBy: uuid("uploaded_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("ticket_attachments_ticket_idx").on(table.ticketId, table.createdAt)]
)

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  location: text("location"),
  category: text("category").notNull().default("corporate"),
  isAllDay: boolean("is_all_day").notNull().default(false),
  createdBy: uuid("created_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const knowledgeArticles = pgTable("knowledge_articles", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  tags: text("tags"),
  authorId: uuid("author_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  isPublished: boolean("is_published").notNull().default(false),
  viewsCount: integer("views_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const taskStatusEnum = pgEnum("task_status", [
  "new",
  "in_progress",
  "review",
  "done",
  "cancelled",
])

export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high", "critical"])

export const taskProjects = pgTable(
  "task_projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    ownerId: uuid("owner_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    departmentId: uuid("department_id").references((): AnyPgColumn => departments.id, {
      onDelete: "set null",
    }),
    status: text("status").notNull().default("active"),
    color: text("color"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("task_projects_owner_idx").on(table.ownerId),
    index("task_projects_department_idx").on(table.departmentId),
  ]
)

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("new"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    assigneeId: uuid("assignee_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    creatorId: uuid("creator_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references((): AnyPgColumn => departments.id, {
      onDelete: "set null",
    }),
    projectId: uuid("project_id").references((): AnyPgColumn => taskProjects.id, {
      onDelete: "set null",
    }),
    dueDate: date("due_date"),
    parentTaskId: uuid("parent_task_id").references((): AnyPgColumn => tasks.id, {
      onDelete: "cascade",
    }),
    protocolActionItemId: integer("protocol_action_item_id"),
    sourceMessageId: uuid("source_message_id"),
    sourceChannelId: uuid("source_channel_id"),
    isImportant: boolean("is_important").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    completionResult: text("completion_result"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("tasks_assignee_status_idx").on(table.assigneeId, table.status),
    index("tasks_parent_task_id_idx").on(table.parentTaskId),
    index("tasks_project_id_idx").on(table.projectId),
  ]
)

export const taskTemplates = pgTable(
  "task_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    priority: text("priority"),
    checklistJson: jsonb("checklist_json"),
    creatorId: uuid("creator_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("task_templates_creator_idx").on(table.creatorId)]
)

export const automationRules = pgTable(
  "automation_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    trigger: text("trigger").notNull(),
    action: text("action").notNull(),
    config: jsonb("config"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("automation_rules_created_by_idx").on(table.createdBy)]
)

export const taskParticipants = pgTable(
  "task_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("task_participants_task_user_role_idx").on(table.taskId, table.userId, table.role),
    index("task_participants_task_idx").on(table.taskId),
  ]
)

export const taskChecklistItems = pgTable(
  "task_checklist_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    isDone: boolean("is_done").notNull().default(false),
    assigneeId: uuid("assignee_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("task_checklist_items_task_idx").on(table.taskId, table.sortOrder)]
)

export const taskLinks = pgTable(
  "task_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("task_links_unique_idx").on(table.taskId, table.entityType, table.entityId)]
)

export const taskComments = pgTable("task_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const taskAttachments = pgTable(
  "task_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    attachmentType: text("attachment_type").notNull().default("general"),
    uploadedBy: uuid("uploaded_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("task_attachments_task_idx").on(table.taskId, table.createdAt)]
)

export const taskActivityLog = pgTable(
  "task_activity_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    field: text("field"),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("task_activity_log_task_created_idx").on(table.taskId, table.createdAt)]
)

export const chatChannelTypeEnum = pgEnum("chat_channel_type", [
  "direct",
  "group",
  "department",
  "task",
  "channel",
])

export const chatChannels = pgTable(
  "chat_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name"),
    type: chatChannelTypeEnum("type").notNull().default("direct"),
    taskId: uuid("task_id").references((): AnyPgColumn => tasks.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").references((): AnyPgColumn => departments.id, {
      onDelete: "set null",
    }),
    createdBy: uuid("created_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    directKey: text("direct_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("chat_channels_task_id_idx")
      .on(table.taskId)
      .where(sql`${table.taskId} is not null`),
    uniqueIndex("chat_channels_direct_key_idx")
      .on(table.directKey)
      .where(sql`${table.directKey} is not null`),
    uniqueIndex("chat_channels_department_unique_idx")
      .on(table.departmentId)
      .where(sql`${table.type} = 'department' and ${table.departmentId} is not null`),
  ]
)

export const chatChannelMembers = pgTable(
  "chat_channel_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("chat_channel_members_channel_user_idx").on(table.channelId, table.userId),
  ]
)

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    messageType: text("message_type").notNull().default("user"),
    replyToId: uuid("reply_to_id").references((): AnyPgColumn => chatMessages.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
  },
  (table) => [index("chat_messages_channel_created_idx").on(table.channelId, table.createdAt)]
)

export const chatReactions = pgTable(
  "chat_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("chat_reactions_message_user_emoji_idx").on(table.messageId, table.userId, table.emoji),
    index("chat_reactions_message_idx").on(table.messageId),
  ]
)

export const chatAttachments = pgTable(
  "chat_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    fileName: text("file_name").notNull(),
    fileUrl: text("file_url").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    uploadedBy: uuid("uploaded_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("chat_attachments_message_idx").on(table.messageId, table.createdAt)]
)

export const chatFolders = pgTable(
  "chat_folders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("chat_folders_user_idx").on(table.userId, table.sortOrder)]
)

export const chatFolderChannels = pgTable(
  "chat_folder_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    folderId: uuid("folder_id")
      .notNull()
      .references(() => chatFolders.id, { onDelete: "cascade" }),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("chat_folder_channels_folder_channel_idx").on(table.folderId, table.channelId),
    index("chat_folder_channels_channel_idx").on(table.channelId),
  ]
)

export const chatPinnedMessages = pgTable(
  "chat_pinned_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    channelId: uuid("channel_id")
      .notNull()
      .references(() => chatChannels.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    pinnedBy: uuid("pinned_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("chat_pinned_messages_channel_message_idx").on(table.channelId, table.messageId),
    index("chat_pinned_messages_channel_idx").on(table.channelId, table.createdAt),
  ]
)

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("notifications_user_read_created_idx").on(table.userId, table.readAt, table.createdAt)]
)

export const taskReminders = pgTable(
  "task_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("task_reminders_unique_idx").on(table.taskId, table.userId, table.kind),
    index("task_reminders_task_idx").on(table.taskId),
  ]
)

export const notificationPreferences = pgTable("notification_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  emailEnabled: boolean("email_enabled").notNull().default(true),
  inAppEnabled: boolean("in_app_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const companies = pgTable("companies", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  inn: text("inn"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export const dealStages = pgTable(
  "deal_stages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    color: text("color"),
  },
  (table) => [index("deal_stages_sort_order_idx").on(table.sortOrder)]
)

export const deals = pgTable(
  "deals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "set null" }),
    stageId: uuid("stage_id").references(() => dealStages.id, { onDelete: "set null" }),
    amount: integer("amount"),
    ownerId: uuid("owner_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    source: text("source"),
    tags: jsonb("tags"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("deals_company_idx").on(table.companyId),
    index("deals_stage_idx").on(table.stageId),
    index("deals_owner_idx").on(table.ownerId),
  ]
)

export const dealActivities = pgTable(
  "deal_activities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("deal_activities_deal_idx").on(table.dealId, table.createdAt)]
)

export const dashboardWidgets = pgTable(
  "dashboard_widgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    widgetType: text("widget_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    config: jsonb("config"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("dashboard_widgets_user_idx").on(table.userId, table.sortOrder)]
)

export const chatPolls = pgTable(
  "chat_polls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    allowMultiple: boolean("allow_multiple").notNull().default(false),
    closesAt: timestamp("closes_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("chat_polls_message_idx").on(table.messageId)]
)

export const chatPollOptions = pgTable("chat_poll_options", {
  id: uuid("id").defaultRandom().primaryKey(),
  pollId: uuid("poll_id")
    .notNull()
    .references(() => chatPolls.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
})

export const chatPollVotes = pgTable(
  "chat_poll_votes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => chatPolls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => chatPollOptions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("chat_poll_votes_poll_option_user_idx").on(table.pollId, table.optionId, table.userId),
    index("chat_poll_votes_poll_idx").on(table.pollId),
  ]
)

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("push_subscriptions_user_idx").on(table.userId)]
)

export const ticketSlaPolicies = pgTable(
  "ticket_sla_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id").references(() => ticketCategories.id, { onDelete: "cascade" }),
    firstResponseMinutes: integer("first_response_minutes").notNull().default(60),
    resolveMinutes: integer("resolve_minutes").notNull().default(1440),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("ticket_sla_policies_category_unique_idx")
      .on(table.categoryId)
      .where(sql`${table.categoryId} is not null`),
  ]
)

export const documentVersions = pgTable(
  "document_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    versionLabel: text("version_label").notNull(),
    fileUrl: text("file_url"),
    changeNote: text("change_note"),
    uploadedBy: uuid("uploaded_by").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("document_versions_document_idx").on(table.documentId, table.createdAt)]
)
