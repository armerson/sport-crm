-- Index every Phase 1/2 foreign-key path not already covered by a leading index.
create index development_goal_updates_created_by_idx
  on public.development_goal_updates(created_by) where created_by is not null;
create index player_assessment_feedback_created_by_idx
  on public.player_assessment_feedback(created_by) where created_by is not null;
create index player_development_goals_category_idx
  on public.player_development_goals(category_id) where category_id is not null;
create index player_development_goals_created_by_idx
  on public.player_development_goals(created_by) where created_by is not null;
create index player_development_goals_originating_team_idx
  on public.player_development_goals(originating_team_id) where originating_team_id is not null;
create index player_review_private_notes_updated_by_idx
  on public.player_review_private_notes(updated_by) where updated_by is not null;
create index test_definitions_category_idx
  on public.test_definitions(category_id);
create index test_results_recorded_by_idx
  on public.test_results(recorded_by) where recorded_by is not null;
create index testing_events_created_by_idx
  on public.testing_events(created_by) where created_by is not null;
