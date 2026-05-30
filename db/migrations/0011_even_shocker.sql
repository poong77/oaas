CREATE TABLE "menu_taxonomies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"product_code" text NOT NULL,
	"parent_id" uuid,
	"label" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "menu_taxonomies" ADD CONSTRAINT "menu_taxonomies_parent_id_menu_taxonomies_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menu_taxonomies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "menu_taxonomies_label_uq" ON "menu_taxonomies" USING btree ("product_code","parent_id","label");--> statement-breakpoint
CREATE INDEX "menu_taxonomies_product_parent_idx" ON "menu_taxonomies" USING btree ("product_code","parent_id","sort_order");--> statement-breakpoint
CREATE INDEX "menu_taxonomies_active_idx" ON "menu_taxonomies" USING btree ("is_active");