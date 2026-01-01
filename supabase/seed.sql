-- Seed data for development/testing
-- Run this after the initial migration

-- Note: This script creates test data using a placeholder user ID
-- In production, users are created through Supabase Auth

-- Example: Insert a test dashboard (requires a real user to exist first)
-- Uncomment and modify the user_id to test

/*
-- First, you need to create a test user through Supabase Auth
-- Then get their user ID and use it here

DO $$
DECLARE
  test_user_id UUID := 'YOUR_TEST_USER_ID';  -- Replace with actual user ID
  test_workspace_id UUID;
BEGIN
  -- Get the user's personal workspace
  SELECT id INTO test_workspace_id
  FROM public.workspaces
  WHERE owner_id = test_user_id AND type = 'personal';

  -- Insert a sample dashboard
  INSERT INTO public.dashboards (
    workspace_id,
    title,
    slug,
    description,
    data_source,
    data,
    config,
    is_published,
    created_by
  ) VALUES (
    test_workspace_id,
    'Sample Sales Dashboard',
    'sample-sales-dashboard',
    'A sample dashboard showing sales data',
    '{"type": "paste"}'::jsonb,
    '[
      {"month": "Jan", "revenue": 12000, "orders": 150, "category": "Electronics"},
      {"month": "Feb", "revenue": 15000, "orders": 180, "category": "Electronics"},
      {"month": "Mar", "revenue": 13500, "orders": 165, "category": "Electronics"},
      {"month": "Jan", "revenue": 8000, "orders": 200, "category": "Clothing"},
      {"month": "Feb", "revenue": 9500, "orders": 220, "category": "Clothing"},
      {"month": "Mar", "revenue": 11000, "orders": 250, "category": "Clothing"},
      {"month": "Jan", "revenue": 5000, "orders": 80, "category": "Home"},
      {"month": "Feb", "revenue": 6000, "orders": 95, "category": "Home"},
      {"month": "Mar", "revenue": 5500, "orders": 88, "category": "Home"}
    ]'::jsonb,
    '{
      "title": "Sales Dashboard",
      "description": "Monthly sales overview",
      "charts": [
        {
          "id": "chart-1",
          "type": "number_card",
          "title": "Total Revenue",
          "config": {
            "column": "revenue",
            "aggregation": "sum",
            "format": "currency"
          }
        },
        {
          "id": "chart-2",
          "type": "number_card",
          "title": "Total Orders",
          "config": {
            "column": "orders",
            "aggregation": "sum",
            "format": "number"
          }
        },
        {
          "id": "chart-3",
          "type": "bar",
          "title": "Revenue by Category",
          "config": {
            "xAxis": {"column": "category"},
            "yAxis": {"column": "revenue", "aggregation": "sum", "format": "currency"},
            "orientation": "vertical"
          }
        },
        {
          "id": "chart-4",
          "type": "line",
          "title": "Revenue Trend",
          "config": {
            "xAxis": {"column": "month", "type": "category"},
            "yAxis": {"column": "revenue", "aggregation": "sum", "format": "currency"},
            "splitBy": "category",
            "smooth": true
          }
        }
      ]
    }'::jsonb,
    false,
    test_user_id
  );

  RAISE NOTICE 'Sample dashboard created successfully';
END $$;
*/

-- Verification queries (safe to run anytime)
SELECT 'Tables created:' AS status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

SELECT 'RLS enabled on:' AS status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
