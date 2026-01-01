# Email Templates

Email templates for Zeno authentication and user communication.

## Templates

### `otp-code.html`
Sent when a user requests to sign in with OTP (One-Time Password).

**Template Variables (Supabase):**
- `{{ .Token }}` - The 6-digit OTP code
- `{{ .SiteURL }}` - The application URL

### `welcome.html`
Sent after a user's first successful sign-in/sign-up.

**Template Variables (Supabase):**
- `{{ .SiteURL }}` - The application URL

## Configuring in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Email Templates**
3. Select the template type (e.g., "Magic Link" for OTP)
4. Replace the default template with the HTML from these files
5. Update the Subject line:
   - OTP: `Your Zeno login code`
   - Welcome: `Welcome to Zeno!`

## Subject Lines

| Template | Recommended Subject |
|----------|---------------------|
| OTP Code | `Your Zeno login code` |
| Welcome  | `Welcome to Zeno!` |

## Customization

### Colors
The templates use Zeno's brand colors:
- Primary: `#2563EB` (blue)
- Text: `#111827` (dark gray)
- Secondary text: `#4b5563` (medium gray)
- Background: `#f5f5f5` (light gray)

### Logo
To add a logo image, replace the text logo in the header with an `<img>` tag:
```html
<img src="https://your-domain.com/logo.png" alt="Zeno" width="120" height="40" />
```

## Testing

To preview emails locally:
1. Open the HTML file in a browser
2. Use a tool like [Litmus](https://www.litmus.com/) or [Email on Acid](https://www.emailonacid.com/) for cross-client testing

## Email Client Compatibility

These templates are designed to work with:
- Gmail (Web, iOS, Android)
- Apple Mail (macOS, iOS)
- Outlook (Web, Desktop, Mobile)
- Yahoo Mail
- Other modern email clients

The templates use:
- Inline styles for maximum compatibility
- Table-based layouts for Outlook support
- MSO conditionals for Outlook-specific fixes
- System fonts with fallbacks
