import {
  type AnyPgColumn,
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

export const userRoleEnum = pgEnum("user_role", ["admin", "hr_manager", "employee"])

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  headUserId: uuid("head_user_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => departments.id, { onDelete: "set null" }),
  regulationsDocId: uuid("regulations_doc_id").references((): AnyPgColumn => documents.id, {
    onDelete: "set null",
  }),
  standardsDocId: uuid("standards_doc_id").references((): AnyPgColumn => documents.id, {
    onDelete: "set null",
  }),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const employeeProfiles = pgTable("employee_profiles", {
  userId: uuid("user_id")
    .notNull()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  positionTitle: text("position_title"),
  office: text("office"),
  birthDate: date("birth_date"),
  startDate: date("start_date"),
  welcomeNote: text("welcome_note"),
  presence: text("presence").notNull().default("office"),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

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
