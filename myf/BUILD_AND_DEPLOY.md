# Build and Deploy Instructions

## Step 1: Build the Frontend
```bash
cd Beacon-PBI-Local/Beacon-PBI/myf
npm run build
```

## Step 2: Copy dist folder to Databricks folder
```bash
# From the myf directory
xcopy /E /I /Y dist ..\..\..\db-beacon\app\dist
```

Or manually:
1. Copy the entire `dist` folder from `Beacon-PBI-Local/Beacon-PBI/myf/dist`
2. Paste it into `db-beacon/app/` (replace existing dist folder)

## Step 3: Upload to Databricks
Upload these files to your Databricks workspace:
- `db-beacon/app/app.py` (updated with new prompts)
- `db-beacon/app/dist/` (entire folder with new build)
- `db-beacon/app/app.yaml`
- `db-beacon/app/requirements.txt`

## Step 4: Restart the Databricks App

## Changes Made:
1. ✅ Added `@tailwindcss/typography` plugin to tailwind config
2. ✅ Enhanced prose styling in MessageBubble component for better formatting
3. ✅ Updated LLM prompts to generate better markdown
4. ✅ Added comprehensive formatting rules for:
   - Bold text
   - Headers (##, ###)
   - Lists (bullets and numbered)
   - Tables
   - Code blocks
   - Blockquotes
   - Links
