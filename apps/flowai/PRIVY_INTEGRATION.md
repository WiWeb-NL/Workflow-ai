# Privy + Better Auth Integration

This integration allows you to use Privy's authentication modal and embedded wallet features alongside your existing Better Auth system. Users can authenticate via Privy (with Web3 wallet support) or continue using traditional email/password and OAuth methods.

## Features

- **Dual Authentication Support**: Use Privy for modern Web3 authentication or Better Auth for traditional methods
- **Embedded Wallets**: Privy provides embedded wallets for users who authenticate through it
- **JWT Integration**: Better Auth generates JWTs that Privy can verify for seamless integration
- **Wallet Address Storage**: User wallet addresses are stored in your existing database schema
- **Seamless User Sync**: Users authenticated via Privy are automatically synced with your Better Auth database

## Setup Instructions

### 1. Privy Dashboard Setup

1. Go to [Privy Dashboard](https://dashboard.privy.io)
2. Create a new app or select an existing one
3. Navigate to **Settings** → **Basics** and note your **App ID**
4. Go to **Settings** → **API Keys** and create a new **App Secret**
5. In **Settings** → **JWT Verification**, configure:
   - **JWKS Endpoint**: `https://your-domain.com/api/auth/jwks`
   - **JWT ID Claim**: `id` (or your preferred user ID field)

### 2. Environment Variables

Add these variables to your `.env.local` file:

```bash
# Privy Configuration
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
PRIVY_APP_SECRET=your_privy_app_secret_here

# Better Auth JWT Configuration (should already exist)
BETTER_AUTH_SECRET=your_32_character_secret_here
BETTER_AUTH_URL=http://localhost:3000  # Update for production
```

### 3. Database Migration

The integration uses the existing `walletAddress` field in your user table. If you need to run migrations:

```bash
bun db:migrate
```

### 4. Usage in Components

#### Using the Integrated Hook

For components that need to work with both authentication methods:

```tsx
import { useIntegratedAuth } from "@/lib/auth/use-integrated-auth";

function MyComponent() {
  const { user, authenticated, login, logout } = useIntegratedAuth();

  if (!authenticated) {
    return <button onClick={() => login()}>Sign In</button>;
  }

  return (
    <div>
      <p>Welcome, {user?.name}!</p>
      {user?.walletAddress && <p>Wallet: {user.walletAddress}</p>}
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}
```

#### Using Privy Directly

For components that specifically need Privy features:

```tsx
import { usePrivyAuth } from "@/lib/auth/use-privy-auth";

function WalletComponent() {
  const { user, authenticated, login } = usePrivyAuth();

  if (!authenticated) {
    return <button onClick={() => login()}>Connect Wallet</button>;
  }

  return (
    <div>
      <p>Wallet: {user?.walletAddress}</p>
    </div>
  );
}
```

#### Using the Privy Login Card

The login and signup pages now include Privy authentication:

```tsx
import { PrivyLoginCard } from "@/components/auth/privy-login";

function LoginPage() {
  return (
    <div>
      <PrivyLoginCard callbackUrl="/dashboard" />
    </div>
  );
}
```

## Architecture

### Authentication Flow

1. **Privy Authentication**:

   - User authenticates via Privy modal
   - Privy issues JWT token
   - Token is synced with Better Auth via `/api/auth/privy/sync`
   - Better Auth creates/updates user record and session

2. **Traditional Authentication**:
   - User authenticates via email/password or OAuth
   - Better Auth handles session management
   - JWT tokens available via `/api/auth/token`

### API Endpoints

- `POST /api/auth/privy/sync` - Sync Privy user with Better Auth
- `POST /api/auth/privy/verify` - Verify Privy JWT tokens
- `GET /api/auth/token` - Get Better Auth JWT token
- `GET /api/auth/jwks` - JWKS endpoint for token verification (required for Privy)

### Privy Dashboard Configuration

After creating your Privy app, configure these settings:

1. **JWT Verification Settings** (Settings → JWT Verification):

   - **JWKS Endpoint**: `https://your-domain.com/api/auth/jwks`
   - **JWT ID Claim**: `id`
   - **Issuer**: Your domain (e.g., `https://your-domain.com`)
   - **Audience**: Your domain (e.g., `https://your-domain.com`)

2. **Authentication Methods** (Settings → Login Methods):

   - Configure which login methods to enable (email, Google, GitHub, etc.)

3. **Embedded Wallets** (Settings → Embedded Wallets):
   - Enable embedded wallet creation
   - Configure wallet settings as needed

### Database Schema

The integration uses your existing user table with the `walletAddress` field:

```sql
CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "walletAddress" text UNIQUE,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  "image" text,
  "createdAt" timestamp NOT NULL,
  "updatedAt" timestamp NOT NULL
);
```

## Configuration Options

### Privy Provider Configuration

You can customize the Privy provider in `lib/auth/privy-provider.tsx`:

```tsx
<PrivyProvider
  appId={env.NEXT_PUBLIC_PRIVY_APP_ID}
  config={{
    customAuth: {
      isLoading: false,
      getCustomAccessToken: getCustomToken,
    },
    appearance: {
      theme: 'dark', // or 'light'
      accentColor: '#676FFF',
      logo: '/your-logo.svg',
    },
    loginMethods: ['email', 'google', 'github'], // Customize available methods
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
      requireUserPasswordOnCreate: false,
    },
  }}
>
```

### Better Auth JWT Configuration

JWT settings are configured in `lib/auth.ts`:

```tsx
jwt({
  jwt: {
    issuer: getBaseURL(),
    audience: getBaseURL(),
    expirationTime: "15m",
    definePayload: ({ user, session }) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      // Add other fields as needed
    }),
  },
});
```

## Security Considerations

1. **JWT Verification**: Both systems verify JWTs using JWKS endpoints
2. **CORS Configuration**: Ensure your JWKS endpoint is accessible to Privy
3. **Token Expiration**: JWT tokens expire after 15 minutes by default
4. **Secure Headers**: API routes include proper security headers
5. **Input Validation**: All user inputs are validated before database operations

## Troubleshooting

### Common Issues

1. **Privy Modal Not Showing**: Check that `NEXT_PUBLIC_PRIVY_APP_ID` is set and valid
2. **JWT Verification Fails**: Ensure your JWKS endpoint is accessible at `/api/auth/jwks`
3. **User Sync Issues**: Check network tab for API call errors to `/api/auth/privy/sync`
4. **Environment Variables**: Verify all required environment variables are set

### Debug Logging

Enable debug logging by setting:

```bash
DEBUG=PrivyAuth,PrivySync,PrivyVerify
```

This will log authentication events to help with debugging.

## Migration from Existing Auth

If you're migrating from a different auth system:

1. Existing users can continue using traditional login methods
2. New users can choose either Privy or traditional signup
3. Existing users can link their wallet by authenticating via Privy with the same email
4. No data migration required - the integration works with your existing user table

## Support

For issues related to:

- **Privy Integration**: Check [Privy Documentation](https://docs.privy.io)
- **Better Auth**: Check [Better Auth Documentation](https://better-auth.com)
- **This Integration**: Review the code in `lib/auth/` directory
