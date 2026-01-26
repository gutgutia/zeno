-- Add ai_config to global_settings
-- This allows admins to configure AI settings without redeploying

INSERT INTO global_settings (key, value, description)
VALUES (
  'ai_config',
  '{
    "generateModel": "opus",
    "modifyModel": "sonnet",
    "refreshModel": "sonnet",
    "sandboxTemplate": "python",
    "promptStyle": "enhanced",
    "verboseLogging": true,
    "sandboxTimeoutMs": 480000,
    "commandTimeoutMs": 420000
  }'::jsonb,
  'AI/Agent configuration settings'
)
ON CONFLICT (key) DO NOTHING;
