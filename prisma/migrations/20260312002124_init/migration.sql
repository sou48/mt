-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('received', 'reply', 'draft');

-- CreateEnum
CREATE TYPE "public"."ChannelType" AS ENUM ('email', 'chat', 'phone_memo', 'other');

-- CreateEnum
CREATE TYPE "public"."DictionaryScopeType" AS ENUM ('system', 'company');

-- CreateTable
CREATE TABLE "public"."companies" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."projects" (
    "id" BIGSERIAL NOT NULL,
    "company_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "is_unclassified" BOOLEAN NOT NULL DEFAULT false,
    "created_by_user_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_projects" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "project_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" BIGSERIAL NOT NULL,
    "project_id" BIGINT NOT NULL,
    "message_type" "public"."MessageType" NOT NULL,
    "channel_type" "public"."ChannelType" NOT NULL,
    "subject" VARCHAR(500),
    "source_sender_name" VARCHAR(255),
    "source_sender_address_or_account" VARCHAR(255),
    "source_sent_at" TIMESTAMP(3),
    "registered_by_user_id" BIGINT,
    "created_by_user_id" BIGINT,
    "source_text" TEXT,
    "source_language" VARCHAR(50),
    "translated_text" TEXT,
    "translated_language" VARCHAR(50),
    "japanese_text" TEXT,
    "partner_text" TEXT,
    "language_pair" VARCHAR(100),
    "signature_id" BIGINT,
    "signature_snapshot" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."attachments" (
    "id" BIGSERIAL NOT NULL,
    "message_id" BIGINT NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "stored_path" VARCHAR(1000) NOT NULL,
    "mime_type" VARCHAR(255) NOT NULL,
    "file_size" BIGINT NOT NULL,
    "uploaded_by_user_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."signatures" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "japanese_text" TEXT NOT NULL,
    "partner_text" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "signatures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dictionary_entries" (
    "id" BIGSERIAL NOT NULL,
    "scope_type" "public"."DictionaryScopeType" NOT NULL,
    "company_id" BIGINT,
    "source_term" VARCHAR(255) NOT NULL,
    "target_term" VARCHAR(255) NOT NULL,
    "note" TEXT,
    "language_pair" VARCHAR(100) NOT NULL,
    "created_by_user_id" BIGINT,
    "updated_by_user_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "dictionary_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."password_reset_tokens" (
    "id" BIGSERIAL NOT NULL,
    "user_id" BIGINT NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_histories" (
    "id" BIGSERIAL NOT NULL,
    "message_id" BIGINT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "changed_by_user_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."signature_histories" (
    "id" BIGSERIAL NOT NULL,
    "signature_id" BIGINT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "changed_by_user_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signature_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."dictionary_entry_histories" (
    "id" BIGSERIAL NOT NULL,
    "dictionary_entry_id" BIGINT NOT NULL,
    "snapshot_json" JSONB NOT NULL,
    "changed_by_user_id" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dictionary_entry_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "public"."companies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_company_id_idx" ON "public"."users"("company_id");

-- CreateIndex
CREATE INDEX "projects_company_id_idx" ON "public"."projects"("company_id");

-- CreateIndex
CREATE INDEX "projects_company_id_name_idx" ON "public"."projects"("company_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "user_projects_user_id_project_id_key" ON "public"."user_projects"("user_id", "project_id");

-- CreateIndex
CREATE INDEX "messages_project_id_idx" ON "public"."messages"("project_id");

-- CreateIndex
CREATE INDEX "messages_project_id_source_sent_at_created_at_idx" ON "public"."messages"("project_id", "source_sent_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_message_type_idx" ON "public"."messages"("message_type");

-- CreateIndex
CREATE INDEX "messages_channel_type_idx" ON "public"."messages"("channel_type");

-- CreateIndex
CREATE INDEX "attachments_message_id_idx" ON "public"."attachments"("message_id");

-- CreateIndex
CREATE INDEX "signatures_user_id_idx" ON "public"."signatures"("user_id");

-- CreateIndex
CREATE INDEX "dictionary_entries_scope_type_idx" ON "public"."dictionary_entries"("scope_type");

-- CreateIndex
CREATE INDEX "dictionary_entries_company_id_idx" ON "public"."dictionary_entries"("company_id");

-- CreateIndex
CREATE INDEX "dictionary_entries_scope_type_language_pair_source_term_idx" ON "public"."dictionary_entries"("scope_type", "language_pair", "source_term");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "public"."password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "public"."password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "message_histories_message_id_idx" ON "public"."message_histories"("message_id");

-- CreateIndex
CREATE INDEX "signature_histories_signature_id_idx" ON "public"."signature_histories"("signature_id");

-- CreateIndex
CREATE INDEX "dictionary_entry_histories_dictionary_entry_id_idx" ON "public"."dictionary_entry_histories"("dictionary_entry_id");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."projects" ADD CONSTRAINT "projects_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_projects" ADD CONSTRAINT "user_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_projects" ADD CONSTRAINT "user_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_registered_by_user_id_fkey" FOREIGN KEY ("registered_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages" ADD CONSTRAINT "messages_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "public"."signatures"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signatures" ADD CONSTRAINT "signatures_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dictionary_entries" ADD CONSTRAINT "dictionary_entries_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dictionary_entries" ADD CONSTRAINT "dictionary_entries_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dictionary_entries" ADD CONSTRAINT "dictionary_entries_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_histories" ADD CONSTRAINT "message_histories_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."message_histories" ADD CONSTRAINT "message_histories_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signature_histories" ADD CONSTRAINT "signature_histories_signature_id_fkey" FOREIGN KEY ("signature_id") REFERENCES "public"."signatures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."signature_histories" ADD CONSTRAINT "signature_histories_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dictionary_entry_histories" ADD CONSTRAINT "dictionary_entry_histories_dictionary_entry_id_fkey" FOREIGN KEY ("dictionary_entry_id") REFERENCES "public"."dictionary_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."dictionary_entry_histories" ADD CONSTRAINT "dictionary_entry_histories_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
