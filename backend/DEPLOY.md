# Turning on accounts (AWS)

This folder is the community backend: sign-in (Amazon Cognito), one database table (DynamoDB) and one small API
(Lambda behind API Gateway). Until it's deployed, the public site keeps each person's diary on their device; after,
everyone signs in, and the first sign-in on a device moves that device's diary into the account.

At small scale this should cost little or nothing: each service has a free tier, and the table bills per request.
Check current AWS pricing before launch.

## One-time setup (about 20 minutes)

1. **AWS account.** Sign in at console.aws.amazon.com. Pick a region and stay in it (us-east-1 is fine).
2. **Install two tools** on your computer:
   - AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
   - AWS SAM CLI: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
3. **Give the CLI access.** In the AWS console, open IAM → Users → Create user (for example `sound-lineage-deploy`), attach
   `AdministratorAccess` for the first deploy, then Security credentials → Create access key → "Command Line Interface".
   On your computer run `aws configure` and paste the key, secret and region.

## Deploy

From this `backend/` folder:

    sam build
    sam deploy --guided

Answer the prompts:
- Stack name: `sound-lineage`
- Region: the one you chose
- `SiteUrl`: `https://scarusillo.github.io/Sound-Lineage/` (or your own domain later)
- `SiteOrigin`: `https://scarusillo.github.io`
- `AuthPrefix`: something unique, for example `sound-lineage-scott`
- Accept the defaults for the rest, and say yes to saving the settings so later deploys are just `sam deploy`.

When it finishes it prints four outputs: **ApiUrl, AuthDomain, ClientId, UserPoolId**.

## Point the app at it

Open `site/config.js` and fill in:

    api: "<ApiUrl>",
    authDomain: "<AuthDomain>",
    clientId: "<ClientId>",

Commit and push. The site republishes, and the Profile tab now shows **Sign in**. (Or paste the four outputs to Claude
and it will do this step.)

## Make yourself an admin

Admins can feature curators and hide reported posts. After you've signed in once:

    aws cognito-idp admin-add-user-to-group --user-pool-id <UserPoolId> --username <your email> --group-name admin

Sign out and back in to pick it up.

## Later

- **Your own domain**: point it at GitHub Pages (or AWS Amplify Hosting), then redeploy with the new `SiteUrl`/`SiteOrigin`.
- **App Store / Google Play**: the site is already an installable app. For the stores, wrap it with Capacitor
  (`npm i @capacitor/core @capacitor/cli && npx cap init && npx cap add ios`), which needs an Apple developer account ($99/year).
- **Sign in with Apple or Google**: add them as identity providers on the Cognito user pool, then list them in
  `SupportedIdentityProviders` in `template.yaml`.

## Tests

    npm test                      # the API's rules: ownership, follows, notifications, private profiles, clubs, admin
    node test/local-server.mjs    # the API on localhost:8790 with an in-memory database, for trying the app locally
