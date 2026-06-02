#!/bin/bash
echo "Creating .env file..."
cat > .env << 'EOF'
SUPABASE_URL="https://jngoqawrtybqwavqrnsy.supabase.co"
SUPABASE_KEY="sb_publishable_XBTxnoQUrVTOJINIrspb_Q_jCAzcrN-"
PORT=3000
NODE_ENV=development
JWT_SECRET=bc-petroleum-secret-2026-change-in-production
SESSION_SECRET=session-secret-2026-change-in-production
EOF
echo "✅ .env file created successfully!"
echo ""
echo "⚠️  Note: Your SUPABASE_KEY looks unusual. It should be a long JWT token."
echo "Please verify your anon key from Supabase Dashboard → Settings → API"
