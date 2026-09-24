CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_hu" text NOT NULL,
	"name_en" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "generation_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"lang" text NOT NULL,
	"category_id" integer,
	"difficulty" smallint,
	"requested" integer NOT NULL,
	"accepted" integer DEFAULT 0 NOT NULL,
	"rejected" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_seen" (
	"household_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "household_seen_household_id_question_id_pk" PRIMARY KEY("household_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_answers" (
	"match_id" uuid NOT NULL,
	"round" smallint NOT NULL,
	"question_id" uuid NOT NULL,
	"seat" smallint NOT NULL,
	"choice" smallint,
	"correct" boolean NOT NULL,
	"response_ms" integer,
	"points" integer NOT NULL,
	CONSTRAINT "match_answers_match_id_round_seat_pk" PRIMARY KEY("match_id","round","seat")
);
--> statement-breakpoint
CREATE TABLE "match_players" (
	"match_id" uuid NOT NULL,
	"seat" smallint NOT NULL,
	"name" text NOT NULL,
	"avatar" jsonb NOT NULL,
	"final_score" integer,
	"rank" smallint,
	CONSTRAINT "match_players_match_id_seat_pk" PRIMARY KEY("match_id","seat")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"room_code" text NOT NULL,
	"lang" text NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "question_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" uuid NOT NULL,
	"match_id" uuid,
	"player_name" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_flags_once_per_match" UNIQUE("question_id","match_id","player_name"),
	CONSTRAINT "question_flags_reason_check" CHECK ("question_flags"."reason" in ('wrong_answer', 'ambiguous', 'typo', 'offensive', 'other'))
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lang" text NOT NULL,
	"category_id" integer NOT NULL,
	"kind" text DEFAULT 'mc' NOT NULL,
	"difficulty" smallint NOT NULL,
	"prompt" text NOT NULL,
	"payload" jsonb NOT NULL,
	"explanation" text,
	"source" text NOT NULL,
	"source_ref" text,
	"status" text DEFAULT 'active' NOT NULL,
	"verifier_score" real,
	"flag_count" integer DEFAULT 0 NOT NULL,
	"times_shown" integer DEFAULT 0 NOT NULL,
	"times_correct" integer DEFAULT 0 NOT NULL,
	"norm_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_lang_norm_hash_unique" UNIQUE("lang","norm_hash"),
	CONSTRAINT "questions_lang_check" CHECK ("questions"."lang" in ('hu', 'en')),
	CONSTRAINT "questions_kind_check" CHECK ("questions"."kind" in ('mc', 'link', 'sort')),
	CONSTRAINT "questions_difficulty_check" CHECK ("questions"."difficulty" between 1 and 3),
	CONSTRAINT "questions_source_check" CHECK ("questions"."source" in ('claude', 'opentdb', 'manual')),
	CONSTRAINT "questions_status_check" CHECK ("questions"."status" in ('active', 'retired'))
);
--> statement-breakpoint
ALTER TABLE "generation_batches" ADD CONSTRAINT "generation_batches_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_seen" ADD CONSTRAINT "household_seen_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "household_seen" ADD CONSTRAINT "household_seen_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_answers" ADD CONSTRAINT "match_answers_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_answers" ADD CONSTRAINT "match_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_flags" ADD CONSTRAINT "question_flags_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_flags" ADD CONSTRAINT "question_flags_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_selection_idx" ON "questions" USING btree ("lang","category_id","kind","status","difficulty");--> statement-breakpoint
CREATE INDEX "questions_prompt_trgm_idx" ON "questions" USING gin ("prompt" gin_trgm_ops);