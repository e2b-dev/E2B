# 💻 Development setup
For developing with hot reloading and contributing to the project you may want to run the app locally without Docker (`npm start` command). Here are the steps for how to do it.

You will need:
- OpenAI API key (support for more and custom models coming soon)
- Docker (For starting the Supabase DB locally)
- Node.js *16+*
- Python *3.10+*
- Poetry *1.3.2+*
- Free ports 3000, 49155, 49160, 54321, 54322

## 1. Install dependencies
```
npm run install:all
```

## 2. Start local Supabase
```
npm run db:start
```

Local Supabase runs in the background - to stop it you have to run `npm run db:stop`.

## 3. Add env vars
Create `.env` file by copying the [`.env.example`](.env.example)
```
cp .env.example .env
```
and fill in the following variables:
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key you got in the previous step as `service_role key: eyJh......`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key you got in the previous step as `anon key: eyJh......`

## 4. Start the app
```
npm run dev
```
Then open page on [http://localhost:3000](http://localhost:3000) and sign in with the testing credentials:

**Email**

`admin@admin.com`

**Password**

`admin@admin.com`
