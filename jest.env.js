// Load OpenAI shims before any other imports
require('openai/shims/node')

process.env.NODE_ENV = 'test'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_reportrunner'
process.env.OPENAI_API_KEY = 'sk-test-key'
process.env.RESEND_API_KEY = 're-test-key'
process.env.DEMO_MODE_ENABLED = 'true'
process.env.DEMO_CACHE_DURATION_MS = '1000'
process.env.DEMO_LLM_TIMEOUT_MS = '100'