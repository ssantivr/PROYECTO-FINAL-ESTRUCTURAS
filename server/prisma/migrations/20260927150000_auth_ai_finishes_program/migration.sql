-- CreateEnum
CREATE TYPE "BuildingType" AS ENUM ('house', 'residential', 'office', 'retail', 'warehouse', 'hotel', 'other');

-- CreateEnum
CREATE TYPE "LotShape" AS ENUM ('rectangular', 'corner', 'trapezoidal', 'irregular');

-- CreateEnum
CREATE TYPE "FinishSlot" AS ENUM ('walls', 'roof', 'floor', 'frames');

-- CreateEnum
CREATE TYPE "FloorPlanKind" AS ENUM ('floor', 'site', 'elevation', 'section');

-- CreateEnum
CREATE TYPE "AIRequestKind" AS ENUM ('chat', 'terrain_analysis', 'material_recommendation', 'layout');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MaterialCategory" ADD VALUE 'Fachada';
ALTER TYPE "MaterialCategory" ADD VALUE 'Pisos';
ALTER TYPE "MaterialCategory" ADD VALUE 'Aislamiento';

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "building_type" "BuildingType" NOT NULL DEFAULT 'house',
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "owner_id" TEXT;

-- AlterTable
ALTER TABLE "terrains" ADD COLUMN     "access_side" "FacadeSide" NOT NULL DEFAULT 'front',
ADD COLUMN     "garden_area" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "parking_area" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pool_area" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shape" "LotShape" NOT NULL DEFAULT 'rectangular';

-- AlterTable
ALTER TABLE "buildings" ADD COLUMN     "balcony" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bathrooms" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "bedrooms" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dining_room" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "garage" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "garden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kitchen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "laundry" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "living_room" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "office" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pool" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "program_floors" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "terrace" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "color" VARCHAR(7) NOT NULL DEFAULT '#999999',
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "metalness" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "roughness" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
ADD COLUMN     "slot" "FinishSlot";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_materials" (
    "project_id" TEXT NOT NULL,
    "slot" "FinishSlot" NOT NULL,
    "material_id" TEXT NOT NULL,

    CONSTRAINT "project_materials_pkey" PRIMARY KEY ("project_id","slot")
);

-- CreateTable
CREATE TABLE "floor_plans" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "kind" "FloorPlanKind" NOT NULL,
    "floor_key" VARCHAR(40),
    "name" VARCHAR(120) NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "floor_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "project_id" TEXT,
    "kind" "AIRequestKind" NOT NULL,
    "input" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generations" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "model" VARCHAR(160),
    "output" JSONB NOT NULL,
    "fallback_reason" TEXT,
    "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "floor_plans_project_id_created_at_idx" ON "floor_plans"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_requests_project_id_created_at_idx" ON "ai_requests"("project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_generations_request_id_key" ON "ai_generations"("request_id");

-- CreateIndex
CREATE INDEX "projects_owner_id_updated_at_idx" ON "projects"("owner_id", "updated_at");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_materials" ADD CONSTRAINT "project_materials_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floor_plans" ADD CONSTRAINT "floor_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "ai_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

