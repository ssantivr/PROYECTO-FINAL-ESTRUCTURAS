-- CreateEnum
CREATE TYPE "Orientation" AS ENUM ('N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW');

-- CreateEnum
CREATE TYPE "FacadeSide" AS ENUM ('front', 'back', 'left', 'right');

-- CreateEnum
CREATE TYPE "OpeningKind" AS ENUM ('window', 'door');

-- CreateEnum
CREATE TYPE "MaterialCategory" AS ENUM ('Estructura', 'Mampostería', 'Acabados', 'Cubierta', 'Carpintería');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "region" VARCHAR(80) NOT NULL,
    "style" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "terrains" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "slope_percent" DOUBLE PRECISION NOT NULL,
    "elevation" DOUBLE PRECISION NOT NULL,
    "orientation" "Orientation" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "soil_type" VARCHAR(120) NOT NULL,
    "max_cos" DOUBLE PRECISION NOT NULL,
    "max_cus" DOUBLE PRECISION NOT NULL,
    "max_floors" INTEGER NOT NULL,

    CONSTRAINT "terrains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "setback_x" DOUBLE PRECISION NOT NULL,
    "setback_y" DOUBLE PRECISION NOT NULL,
    "roof_kind" VARCHAR(20) NOT NULL DEFAULT 'gable',
    "roof_pitch_deg" DOUBLE PRECISION NOT NULL,
    "roof_overhang" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL,
    "building_id" TEXT NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL,
    "level" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "footprint_x" DOUBLE PRECISION NOT NULL,
    "footprint_y" DOUBLE PRECISION NOT NULL,
    "footprint_width" DOUBLE PRECISION NOT NULL,
    "footprint_depth" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "floor_id" TEXT NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "position" INTEGER NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "depth" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "openings" (
    "id" TEXT NOT NULL,
    "floor_id" TEXT NOT NULL,
    "side" "FacadeSide" NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "OpeningKind" NOT NULL,
    "offset" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "sill" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "openings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "category" "MaterialCategory" NOT NULL,
    "unit" VARCHAR(12) NOT NULL,
    "rate_per_m2" DOUBLE PRECISION NOT NULL,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "terrains_project_id_key" ON "terrains"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "buildings_project_id_key" ON "buildings"("project_id");

-- CreateIndex
CREATE INDEX "floors_building_id_position_idx" ON "floors"("building_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "floors_building_id_key_key" ON "floors"("building_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_floor_id_key_key" ON "rooms"("floor_id", "key");

-- CreateIndex
CREATE INDEX "openings_floor_id_side_position_idx" ON "openings"("floor_id", "side", "position");

-- CreateIndex
CREATE UNIQUE INDEX "materials_key_key" ON "materials"("key");

-- AddForeignKey
ALTER TABLE "terrains" ADD CONSTRAINT "terrains_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "openings" ADD CONSTRAINT "openings_floor_id_fkey" FOREIGN KEY ("floor_id") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
