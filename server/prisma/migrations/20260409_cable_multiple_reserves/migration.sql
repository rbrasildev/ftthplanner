-- Add reserves JSON array to cables (multiple technical reserves per cable)
ALTER TABLE "cables" ADD COLUMN "reserves" JSONB DEFAULT '[]';

-- Migrate existing single reserve data to the new array format
UPDATE "cables"
SET "reserves" = jsonb_build_array(
    jsonb_build_object(
        'id', gen_random_uuid(),
        'length', COALESCE("technical_reserve", 0),
        'location', "reserve_location",
        'showLabel', "show_reserve_label"
    )
)
WHERE "technical_reserve" IS NOT NULL AND "technical_reserve" > 0;
