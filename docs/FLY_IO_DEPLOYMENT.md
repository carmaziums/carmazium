# Deploying CarMazium Backend to Fly.io

This guide assumes you have the [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/) installed and are logged in (`fly auth login`).

## 1. Initialize Fly App

Navigate to the `backend` directory and launch the app.
```bash
cd backend
fly launch
```
- **App Name**: Choose a unique name (e.g., `carmazium-backend-production`).
- **Region**: Choose the one closest to your users (e.g., `lhr` for London/Europe, `iad` for US East).
- **Configuration**: It will detect the `Dockerfile` and `fly.toml`. **Do not** overwrite them if asked, but if it says "An existing fly.toml file was found", say **Yes** to copy its configuration to the new app.
- **Database**: Say **No** (we are using Supabase).
- **Redis**: Say **No** (we are not using Redis yet).

## 2. Set Secrets (Environment Variables)

Run the following command to set your production secrets. I have populated the values from your local `.env` files where possible.

> [!CAUTION]
> **Missing Key**: You must replace `YOUR_SUPABASE_SERVICE_KEY` with the actual **`service_role`** key from your Supabase Dashboard (Settings > API). **Do not use the `anon` key.**

```bash
fly secrets set \
  DATABASE_URL="postgresql://postgres.qcqnllehtuczgammazwi:Gb6%40Jip%2Fe*xcVEq@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true" \
  DIRECT_URL="postgresql://postgres.qcqnllehtuczgammazwi:Gb6%40Jip%2Fe*xcVEq@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" \
  SUPABASE_URL="https://qcqnllehtuczgammazwi.supabase.co" \
  SUPABASE_SERVICE_KEY="YOUR_SUPABASE_SERVICE_KEY" \
  SESSION_SECRET="FcCD4/6dIbA7BRcuM2K9Q2FLXSP7y6Xl6oJI7Kp74yEwj5P1qF+QPYwOjs9GJKuM9nmyDf+gaRGQmt7qtik/GQ==" \
  NODE_ENV="production"
```

## 3. Deploy

Once secrets are set, deploy the application:

```bash
fly deploy
```

The build process will:
1.  Upload the context to Fly's remote builder.
2.  Install dependencies (including `nest` CLI).
3.  Build the NestJS app.
4.  Run `prisma generate` and `prisma db push` (to sync the database schema).
5.  Start the server on port 8080.

## 4. Verification

Check the status and logs:

```bash
fly status
fly logs
```

If the deployment succeeds, you will see the app running. Update your Frontend's `.env.local` or environment variables to point to the new backend URL:
`NEXT_PUBLIC_API_URL=https://your-app-name.fly.dev`
