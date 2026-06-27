# MARKAZ Home — Authentication, Account Verification, and Onboarding Design Specification

**File:** `MARKAZ-AUTH-ONBOARDING-DESIGN-SPEC.md`  
**Status:** Implementation-ready design specification  
**Milestone:** Week 1.5 — Authentication and Onboarding Hardening  
**Product:** MARKAZ Home  
**Applications:** Customer Web and MARKAZ Operations  
**Primary languages:** English and Arabic  
**Accessibility target:** WCAG 2.2 AA  
**Last updated:** June 2026  

---

## Milestone Understanding

This milestone replaces the existing customer and Admin email-OTP sign-in experience with a complete email-and-password authentication system while preserving the parts of the Week 1 foundation that remain valid: Supabase Auth, secure sessions, the `CUSTOMER` and `ADMIN` account model, separate customer and Admin applications, account-state routing, the persistent profile, simulated UAE PASS, English and Arabic support, RTL behaviour, and the approved MARKAZ visual system.

The finished milestone must support:

- Separate customer Create Account and Sign In experiences
- Full name, email, password, password confirmation, and separate legal acceptance
- Email verification by six-digit code after account creation
- Official Supabase password-recovery and reset flow
- Safe duplicate-account and incorrect-credential messaging
- Resumption of incomplete onboarding
- A clearly disclosed simulated UAE PASS journey
- Session-expiration and sign-out states
- Separate Admin sign-in and recovery
- Explicit denial when a customer account signs into the Admin application
- Responsive English and Arabic interfaces
- Implementation-level copy, validation, accessibility, component, state, and routing specifications

No property-listing, marketplace, offer, transaction, or wider Admin workflow is redesigned in this document.

---

# 1. Executive Summary

MARKAZ Home authentication must feel like the beginning of a premium property relationship rather than a generic software login. The experience should be calm, spacious, secure, and direct. It should explain what is happening without exposing technical implementation details or creating legal ambiguity.

The customer application has one unified account type: `CUSTOMER`. A customer may browse, buy, make offers, create listings, manage listings, and track transactions without choosing a Buyer or Seller role.

The internal application has one authorised account type: `ADMIN`. It is a separate deployment and experience. There is no public Admin registration, and no Admin link may appear in the customer application.

The final authentication model for this milestone is:

- Email and password for normal sign-in
- Email verification after customer account creation
- Six-digit code for email verification only
- Official Supabase recovery flow for forgotten passwords
- Secure session handling through the established Supabase architecture
- Simulated UAE PASS after email and profile completion
- No SMS authentication
- No social sign-in
- No Buyer/Seller role selection

## 1.1 Source precedence and conflict resolution

Earlier architecture, Week 1 delivery, and design-foundation documents describe email OTP as the normal sign-in method. The Week 1.5 decision in this milestone supersedes that authentication mechanic.

Use this order of precedence:

1. **This Week 1.5 design brief and engineering prompt** govern authentication functions and user flows.
2. **The final technical architecture** governs platform, Supabase, security, session, authorisation, application separation, data-residency, rate-limit, audit, and accessibility constraints.
3. **`WEEK-1.md`** describes the current implementation and reusable foundation, not the final authentication behaviour.
4. **The approved design foundation** governs brand, colour, typography, spacing, logo, tone, responsive principles, and reusable visual patterns, except where its earlier OTP-only decision conflicts with this milestone.
5. **Existing screens** may be reused or refactored only when they meet this specification.

### Required migration interpretation

- Existing OTP **sign-in** screens are replaced by email/password Sign In.
- The existing six-digit OTP component is retained and refined for **post-sign-up email verification**.
- Existing profile, UAE PASS, route-resolution, Admin guard, i18n, RTL, and session foundations should be reused.
- Existing customer and Admin applications remain separate.
- Existing authorisation rules remain unchanged: `CUSTOMER` cannot access Admin; `ADMIN` access is validated server-side.

---

# 2. Scope

## 2.1 In scope

### Customer application

- Landing-page authentication entry points
- Create Account
- Account Created / Check Your Email
- Verify Email Code
- Email Verified
- Profile Completion when required data is missing
- Simulated UAE PASS introduction
- Simulated UAE PASS pending
- Simulated UAE PASS success
- Simulated UAE PASS failure and retry
- Sign In
- Forgot Password
- Recovery Email Sent
- Reset Password
- Password Updated
- Session Expired
- Signed-Out confirmation
- Authentication provider unavailable
- Rate-limited state
- Generic unexpected-error state
- Routing to the correct onboarding state
- Safe restoration of an intended customer destination

### Admin application

- Admin Sign In
- Admin Forgot Password
- Admin Recovery Email Sent
- Admin Reset Password
- Admin Password Updated
- Admin Access Denied
- Admin Session Expired
- Admin Signed-Out state

### Shared design scope

- Responsive desktop, tablet, and mobile layouts
- English and Arabic
- RTL behaviour
- WCAG 2.2 AA interaction behaviour
- Exact interface copy
- Validation and error behaviour
- Reusable authentication components
- Non-sensitive audit-event recommendations
- Design-to-engineering handoff details

## 2.2 Out of scope

- Property-listing screens
- Marketplace redesign
- Property-details redesign
- Offers and transactions
- Customer dashboard redesign
- Wider Admin portal redesign
- Admin account creation
- Admin invitations
- Social login
- SMS authentication
- Phone-number capture
- Emirates ID capture
- Passport capture
- Real UAE PASS
- Real identity verification
- Biometric authentication
- Passkeys
- Multi-factor authentication beyond email verification
- Product analytics
- Support-chat design
- Legal-document drafting

---

# 3. Product and Account Rules

## 3.1 Account types

| Account type | Application | Creation method | Access |
|---|---|---|---|
| `CUSTOMER` | MARKAZ Home customer web | Public Create Account | All customer buying and selling journeys |
| `ADMIN` | MARKAZ Operations | Internal provisioning only | Protected Operations application |

## 3.2 Non-negotiable product rules

1. Buyer and Seller are journeys, not account types.
2. Do not show Buyer/Seller selection during sign-up or onboarding.
3. Do not create Buyer-only or Seller-only accounts.
4. Do not show Admin sign-in, Admin registration, or Admin links in the customer application.
5. Do not show customer registration in the Admin application.
6. A valid customer session cannot access the Admin application.
7. A valid Admin session is still subject to the Admin application’s server-side account-type check.
8. Email verification is mandatory before customer onboarding can complete.
9. Password recovery must return generic confirmation regardless of whether an account exists.
10. Sign-in credential errors must not reveal whether the email or password was wrong.
11. Simulated UAE PASS must never imply official, legal, or government verification.
12. The user’s server-side account and onboarding state is the source of truth after every refresh and sign-in.
13. Passwords, verification codes, recovery tokens, access tokens, and refresh tokens must never be stored in UI persistence or audit payloads.

## 3.3 Required customer profile data

For this milestone, the only required customer profile data collected through authentication and onboarding is:

- Full name
- Verified email address
- Terms of Use acceptance timestamp/version
- Privacy Policy acceptance timestamp/version
- Account type: `CUSTOMER`
- Demo identity status

Do not add:

- Phone number
- Date of birth
- Nationality
- Emirates ID
- Passport
- Address
- Buyer/Seller preference
- Property ownership information

## 3.4 Profile completion rule

Profile Completion is a repair and resume screen, not a second registration form.

It shows only required information that is missing or unrecorded, such as:

- Full name
- Terms acceptance
- Privacy acceptance

It must not ask users to re-enter data already stored and valid.

---

# 4. Design Principles

## 4.1 Calm confidence

Use direct headings, restrained blue, readable typography, and generous spacing. Avoid urgent or alarming language unless a security action genuinely requires attention.

## 4.2 Explain the next step

Every screen answers:

- What happened?
- What should I do now?
- What happens after this?

## 4.3 Security without technical jargon

Prefer:

> For your security, please sign in again.

Avoid:

> JWT expired. Refresh token invalid.

## 4.4 One primary action

Every screen has one dominant action. Secondary actions are text links or outlined buttons. Do not show two equally dominant buttons unless the screen is explicitly a demo simulation control.

## 4.5 Preserve safe progress

Preserve non-sensitive progress where appropriate:

- Full name
- Normalised email
- Legal-checkbox state
- Intended internal destination
- Current onboarding step

Never persist:

- Password
- Confirm password
- Verification code
- Recovery token
- Auth token

## 4.6 Errors should support recovery

Errors appear near the relevant field and include a clear recovery path. Form-level errors are reserved for cross-field, account, provider, rate-limit, or server failures.

## 4.7 Simulation without deception

The simulated UAE PASS flow should feel considered and believable while always carrying a visible demo disclosure. It must not reproduce official UAE PASS branding, seals, colours, screens, or government claims.

## 4.8 Accessible is premium

Accessibility is a core quality requirement, not a later polish task. Controls must remain understandable with keyboard, screen reader, zoom, high contrast, reduced motion, autofill, and RTL.

---

# 5. Authentication Information Architecture

```text
Customer Application
│
├── Public Landing
│   ├── Sign In
│   ├── Create Account
│   └── Gated Intent
│       ├── List a property
│       ├── Save a property
│       ├── Save a search
│       └── Make an offer
│
├── Authentication
│   ├── Create Account
│   ├── Account Created
│   ├── Verify Email
│   ├── Email Verified
│   ├── Sign In
│   ├── Forgot Password
│   ├── Recovery Email Sent
│   ├── Reset Password
│   ├── Password Updated
│   ├── Session Expired
│   ├── Signed Out
│   └── Global Auth Errors
│
├── Onboarding
│   ├── Complete Profile
│   ├── UAE PASS Introduction
│   ├── UAE PASS Pending
│   ├── UAE PASS Success
│   └── UAE PASS Failure
│
└── Post-authentication
    ├── Restore safe intended destination
    └── Unified Customer Dashboard

Admin Application
│
├── Admin Sign In
├── Admin Forgot Password
├── Admin Recovery Email Sent
├── Admin Reset Password
├── Admin Password Updated
├── Admin Access Denied
├── Admin Session Expired
└── Admin Signed Out
```

## 5.1 Proposed canonical route patterns

Locale prefixes are mandatory.

### Customer web

| Purpose | Route |
|---|---|
| Create Account | `/[locale]/sign-up` |
| Account Created | `/[locale]/sign-up/check-email` |
| Verify Email | `/[locale]/verify-email` |
| Email Verified | `/[locale]/verify-email/success` |
| Sign In | `/[locale]/sign-in` |
| Forgot Password | `/[locale]/forgot-password` |
| Recovery Email Sent | `/[locale]/forgot-password/check-email` |
| Reset Password | `/[locale]/reset-password` |
| Password Updated | `/[locale]/reset-password/success` |
| Complete Profile | `/[locale]/onboarding/profile` |
| Simulated UAE PASS | `/[locale]/onboarding/uae-pass` |
| Session Expired | `/[locale]/sign-in?notice=session-expired` |
| Signed Out | `/[locale]/signed-out` |
| Persistent provider error | `/[locale]/auth/unavailable` |
| Persistent unexpected error | `/[locale]/auth/error` |

### Admin application

The Admin application is deployed separately; it does not use an `/admin` route inside customer web.

| Purpose | Route |
|---|---|
| Admin Sign In | `/[locale]/sign-in` |
| Admin Forgot Password | `/[locale]/forgot-password` |
| Admin Recovery Email Sent | `/[locale]/forgot-password/check-email` |
| Admin Reset Password | `/[locale]/reset-password` |
| Admin Password Updated | `/[locale]/reset-password/success` |
| Access Denied | `/[locale]/access-denied` |
| Session Expired | `/[locale]/sign-in?notice=session-expired` |
| Signed Out | `/[locale]/signed-out` |

Route names may be adapted to the current App Router folders, but user-visible behaviour and application separation are mandatory.

---

# 6. Customer Flow Diagrams

## 6.1 Create Account

```text
Landing or gated customer action
        ↓
Create Account
        ↓
Client validation passes?
   ├── No → Show field errors
   └── Yes
        ↓
Create CUSTOMER account
        ↓
Account created?
   ├── Duplicate / ambiguous failure
   │     → Safe account-creation message
   │     → Sign In / Forgot Password actions
   ├── Provider / rate failure
   │     → Recoverable form-level state
   └── Yes
        ↓
Account Created / Check Your Email
        ↓
Verify six-digit email code
        ↓
Email verified?
   ├── No → Invalid / expired / rate-limit recovery
   └── Yes
        ↓
Required profile data complete?
   ├── No → Complete Profile
   └── Yes
        ↓
Demo identity status
   ├── NOT_STARTED → UAE PASS Introduction
   ├── PENDING → Pending State
   ├── FAILED_DEMO → Failure and Retry
   └── VERIFIED_DEMO → Restore destination / Dashboard
```

## 6.2 Sign In

```text
Sign In
  ↓
Validate email + password
  ↓
Authenticate
  ├── Incorrect → Generic credentials error
  ├── Rate limited → Retry state
  ├── Provider unavailable → Provider state
  ├── Suspended/unavailable → Generic account-unavailable message
  └── Authenticated
        ↓
Resolve server-side account state
        ├── Email unverified → Verify Email
        ├── Profile incomplete → Complete Profile
        ├── UAE PASS NOT_STARTED → UAE PASS Introduction
        ├── UAE PASS PENDING → Pending State
        ├── UAE PASS FAILED_DEMO → Failure and Retry
        └── UAE PASS VERIFIED_DEMO
              ↓
        Safe intended destination or Dashboard
```

## 6.3 Forgot and Reset Password

```text
Forgot Password
  ↓
Enter email
  ↓
Request recovery
  ↓
Always show generic confirmation
  ↓
User opens official recovery email
  ↓
Validate recovery session
  ├── Invalid / expired → Recovery-session error
  └── Valid
        ↓
Reset Password
        ↓
New password valid and matching?
  ├── No → Field validation
  └── Yes
        ↓
Password Updated
        ↓
Return to Sign In
```

## 6.4 Resume Onboarding

```text
Sign in, refresh, or return from verification
  ↓
Fetch authoritative account/profile state
  ↓
Resolve first unmet requirement
  ├── Email unverified → Verify Email
  ├── Required profile data missing → Complete Profile
  ├── Identity NOT_STARTED → UAE PASS Introduction
  ├── Identity PENDING → UAE PASS Pending
  ├── Identity FAILED_DEMO → UAE PASS Failure
  └── Identity VERIFIED_DEMO → Dashboard / safe destination
```

---

# 7. Admin Flow Diagram

```text
Admin application
      ↓
Admin Sign In
      ↓
Authenticate email + password
  ├── Incorrect → Generic credentials error
  ├── Recovery requested → Admin Forgot Password flow
  ├── Provider/rate failure → Shared recoverable state
  └── Authenticated
        ↓
Server verifies account_type
   ├── ADMIN → Admin Overview
   └── Not ADMIN → Access Denied
                    ├── Sign Out
                    └── Return to MARKAZ Home
```

There is no Admin Create Account route.

---

# 8. Screen Inventory

## 8.1 Customer screens and states

| ID | Screen / state | Type |
|---|---|---|
| C-01 | Landing Page authentication entry | Existing page integration |
| C-02 | Create Account | Form |
| C-03 | Account Created / Check Your Email | Success / transition |
| C-04 | Verify Email Code | Form |
| C-05 | Email Verified | Success |
| C-06 | Profile Completion | Conditional form |
| C-07 | Simulated UAE PASS Introduction | Onboarding |
| C-08 | Simulated UAE PASS Pending | Onboarding status |
| C-09 | Simulated UAE PASS Success | Success |
| C-10 | Simulated UAE PASS Failure | Error / recovery |
| C-11 | Sign In | Form |
| C-12 | Forgot Password | Form |
| C-13 | Recovery Email Sent | Generic success |
| C-14 | Reset Password | Form |
| C-15 | Password Updated | Success |
| C-16 | Session Expired | Notice + Sign In |
| C-17 | Signed-Out Confirmation | Confirmation |
| C-18 | Authentication Provider Unavailable | Blocking recoverable error |
| C-19 | Rate Limited | Inline or blocking recoverable state |
| C-20 | Generic Unexpected Error | Blocking recoverable error |

## 8.2 Admin screens and states

| ID | Screen / state | Type |
|---|---|---|
| A-01 | Admin Sign In | Form |
| A-02 | Admin Forgot Password | Form |
| A-03 | Admin Recovery Email Sent | Generic success |
| A-04 | Admin Reset Password | Form |
| A-05 | Admin Password Updated | Success |
| A-06 | Admin Access Denied | Blocking state |
| A-07 | Admin Session Expired | Notice + Sign In |
| A-08 | Admin Signed Out | Confirmation |

---

# 9. Global Authentication Layout

## 9.1 Visual direction

Use the approved **Architectural Blue — Quiet Editorial Intelligence** system.

### Brand tokens

| Token | Value |
|---|---|
| Deep Architectural Blue | `#0F2A44` |
| Ocean Ink | `#163A5A` |
| Clear Blue | `#1F4E73` |
| Slate Blue | `#486A8A` |
| Mist Blue | `#AFC6DA` |
| Pale Blue | `#EAF2F7` |
| Cool Off-White | `#F6F8FB` |
| Surface White | `#FFFFFF` |
| Blue Black | `#142332` |
| Secondary Slate | `#647482` |
| Border Blue Grey | `#D9E3EA` |

Use semantic green, amber, and red only for success, attention, and failure. Do not use colour as the only status signal.

## 9.2 Logo

Use the approved working MARKAZ Home wordmark:

> **M + layered architectural home/arch symbol + RKAZ**

The symbol replaces the “A”.

- Desktop wordmark width: 176–196 px
- Tablet: 156–176 px
- Mobile: 136–148 px
- Use a production SVG, not image-generated text
- Deep blue on white or off-white
- Standalone blue-square mark may be used for compact Admin or mobile contexts

## 9.3 Customer authentication shell

### Desktop: 1200 px and above

- Page background: Cool Off-White
- Header height: 72 px
- Header surface: white with 1 px bottom border
- Main content max width: 1280 px
- Main horizontal padding: 40 px
- Main grid: 7 columns form area / 5 columns supporting panel
- Main vertical padding: 48 px top, 56 px bottom
- Form column content width:
  - Create Account: max 520 px
  - Other forms: max 480 px
  - Status screens: max 520 px
- Form aligns to the visual centre of the left grid area, not the full viewport
- Supporting panel width: 440–520 px
- Gap between areas: 64–80 px

### Supporting panel

Use one premium UAE residential image or a restrained brand panel.

Recommended content:

> **One account. Every property journey.**  
> Browse, make offers, list your property, and follow each step in one place.

Supporting points:

- Clear account setup
- Secure email verification
- Guided demo identity step

Rules:

- Do not show stock-photo collages.
- Do not place form text over photography.
- Use a subtle deep-blue tint or solid caption area for readability.
- Do not display legal, regulatory, or identity claims in the image.
- Hide the panel below 1024 px.

### Tablet: 768–1199 px

- Header height: 64 px
- Single main column
- Max form width: 520 px
- Main padding: 40 px inline, 48 px block
- Supporting image hidden
- A compact trust statement may appear below the form, max two lines
- Legal links remain in the footer

### Mobile: below 768 px

- Header height: 56 px
- Main padding: 24 px inline; 32 px top; 40 px bottom
- No card shadow
- Form width: 100%
- Logo at logical start
- Language switcher at logical end
- Supporting panel removed
- Footer links stack or wrap
- Buttons full width
- Inputs minimum 48 px high
- Page must remain usable at 320 px viewport width

## 9.4 Authentication form container

Default customer forms should not appear as a floating SaaS card.

- White or off-white form surface
- Desktop may use a subtle 1 px border and 12 px radius for long forms
- Short forms may sit directly on the canvas
- No strong shadow
- Padding:
  - Desktop long form: 36–40 px
  - Tablet: 32 px
  - Mobile: 0 or 24 px depending on surrounding surface
- Vertical section gap: 28–32 px
- Field gap: 20 px
- Label-to-control gap: 8 px
- Control-to-help/error gap: 6–8 px

## 9.5 Header treatment

Customer auth header contains:

- Logo
- Language control: `English` / `العربية`
- Optional text link: `Back to MARKAZ Home`

Do not show full marketplace navigation on focused authentication screens.

Admin auth header contains:

- MARKAZ Operations wordmark or MARKAZ logo plus `OPERATIONS`
- Language control
- No customer navigation
- No Create Account link

## 9.6 Footer

Customer footer:

- Terms of Use
- Privacy Policy
- Cookie Policy, if active
- `© MARKAZ Home`
- Legal links open in a new tab during form completion and include accessible “opens in new tab” text

Admin footer:

- `MARKAZ Operations`
- Privacy
- Security / authorised access notice
- Environment/build label only in non-production if already supported

## 9.7 Authentication progress indicator

Use three milestones for new customer onboarding:

1. Account details
2. Email verification
3. Demo identity

### Desktop

Display a horizontal compact progress indicator above the page title.

Each item has:

- Number or check icon
- Label
- State: complete, current, upcoming, action required

### Mobile

Display:

> Step 2 of 3 · Email verification

with a thin progress line below.

### Resume behaviour

When onboarding data is inconsistent or incomplete, do not imply the user moved backwards. Use a setup-status variant:

- Account details — Action required
- Email verification — Complete
- Demo identity — Not started

This makes the reason for routing explicit.


---

# 10. Customer Sign Up Specification

## 10.1 User objective

Create a unified MARKAZ customer account and begin verification.

## 10.2 Entry points

- Landing page: `List a property`
- Landing page or public menu: `Create account`, where available
- Gated property actions
- Sign In screen: `Create account`
- Direct approved internal route

## 10.3 Page copy

**Progress:** `Step 1 of 3 · Account details`

**Title:**  
> Create your MARKAZ account

**Description:**  
> One account lets you browse properties, make offers, list a property, and track transactions.

**Fields:**

- Full name
- Email address
- Password
- Confirm password

**Legal checkboxes:**

> I agree to the Terms of Use.

> I agree to the Privacy Policy.

**Primary button:**  
> Create account

**Existing-account line:**  
> Already have an account? **Sign in**

**Security reassurance:**  
> Your account details are protected using secure authentication.

## 10.4 Desktop layout

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ MARKAZ HOME                                      English | Back to Home     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Step 1  Account details ── Step 2 Email ── Step 3 Demo identity           │
│                                                                             │
│   Create your MARKAZ account           ┌─────────────────────────────────┐  │
│   One account lets you...               │ Premium property image         │  │
│                                         │                                 │  │
│   Full name                             │ One account. Every property     │  │
│   [________________________________]    │ journey.                        │  │
│                                         │                                 │  │
│   Email address                         │ • Browse                        │  │
│   [________________________________]    │ • Make offers                   │  │
│                                         │ • List property                 │  │
│   Password [show]                       │ • Track progress                │  │
│   [________________________________]    └─────────────────────────────────┘  │
│   Requirements / strength                                                  │
│                                                                             │
│   Confirm password [show]                                                   │
│   [________________________________]                                        │
│                                                                             │
│   □ Terms                                                                   │
│   □ Privacy                                                                 │
│                                                                             │
│   [ Create account ]                                                        │
│   Already have an account? Sign in                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 10.5 Form fields

### Full name

- Visible label: `Full name`
- Placeholder: `Enter your full name`
- Autocomplete purpose: name
- Minimum: 2 characters after trimming
- Maximum: 100 characters
- Allow Arabic and Latin letters, spaces, hyphens, apostrophes, and diacritics
- Do not require exactly two words
- Trim leading/trailing whitespace
- Collapse repeated outer whitespace only; do not rewrite internal name structure without confirmation

### Email address

- Visible label: `Email address`
- Placeholder: `you@example.com`
- Input direction: LTR in both locales
- Autocomplete purpose: email
- Trim leading/trailing whitespace on blur and submission
- Reject internal spaces and malformed addresses
- Preserve the trimmed email for the next verification step
- Do not expose duplicate-account status through field-level copy

### Password

- Visible label: `Password`
- Placeholder: `Create a password`
- Autocomplete purpose: new password
- Minimum 8 characters
- Maximum 128 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one printable non-alphanumeric character
- Spaces do not count as the special-character requirement
- Show/hide button within the control
- Password remains LTR in Arabic
- Do not trim the password
- Do not persist it outside active component memory

### Confirm password

- Visible label: `Confirm password`
- Placeholder: `Re-enter your password`
- Autocomplete purpose: new password
- Must match exactly
- Separate show/hide control
- Validate on blur once both fields have content and on submission

### Terms and Privacy

Use separate required checkboxes.

- Checkbox hit target includes the whole text row
- Terms and Privacy links open in a new tab
- Each link announces that it opens in a new tab
- Legal version and acceptance timestamp are persisted on successful account creation
- Checkbox state may be safely preserved during a provider retry in the same session

## 10.6 Password checklist

Show after the password receives focus or contains content.

Copy:

> Your password must include:

- At least 8 characters
- One uppercase letter
- One lowercase letter
- One number
- One special character

State treatment:

- Unmet, before submission: neutral icon and slate text
- Met: check icon and success text
- Submitted unmet: error icon and error text
- Do not animate or celebrate completion

## 10.7 Password strength

The checklist is authoritative. Strength is supplementary.

| Level | Condition | Label |
|---|---|---|
| Hidden | Empty | No label |
| Incomplete | One or more requirements missing | `Does not yet meet the requirements` |
| Meets requirements | All requirements met, 8–11 characters | `Meets the requirements` |
| Strong | All requirements met and 12+ characters with variety | `Strong password` |

Use a restrained three-segment line. Do not use point scores, emojis, red-to-green games, or terms such as “terrible”.

## 10.8 Submit behaviour

1. On first submission, validate all fields.
2. Move focus to the form error summary if multiple errors exist.
3. Error-summary items link focus to the relevant field.
4. Disable the primary button while the request is active.
5. Button copy changes to `Creating account…`.
6. Prevent double submission.
7. On success:
   - Clear password fields from memory
   - Navigate to Account Created
   - Preserve the normalised email
8. On provider, duplicate-safe, or rate error:
   - Preserve name, email, and legal checkbox state
   - Clear password and confirm-password fields
   - Return focus to the form-level alert
9. Do not create a second profile record if the request is retried idempotently.

## 10.9 Duplicate-account-safe state

Form-level alert:

**Title:**  
> We could not create a new account with these details.

**Body:**  
> You may already have an account. Try signing in or resetting your password.

**Actions:**

- `Sign in`
- `Reset password`

Do not state:

- “This email already exists”
- “We found your account”
- “Email registered”

## 10.10 Tablet and mobile

- Hide supporting panel
- Keep progress above heading
- Buttons full width
- Legal checkbox text wraps beneath the checkbox without reducing its hit area
- Password checklist stays below the password control
- Do not place checklist in a tooltip
- On mobile, use 24 px page padding and 20 px field gaps
- Keyboard opening must not hide the active field or primary action

---

# 11. Email Verification Specification

## 11.1 Account Created / Check Your Email

### Purpose

Confirm successful account creation before asking for the code.

### Copy

**Title:**  
> Check your email

**Description:**  
> We sent a six-digit verification code to **{maskedEmail}**.

**Supporting copy:**  
> Enter the code to verify your email and continue setting up your account.

**Primary button:**  
> Enter verification code

**Secondary link:**  
> Use a different email

**Help:**  
> The code may take a few minutes. Check your spam or junk folder if you do not see it.

### Behaviour

- This screen may be skipped only when the Verify Email screen is shown immediately with an explicit success announcement.
- Primary action moves to Verify Email.
- “Use a different email” returns to Create Account with full name and legal selections preserved, password fields empty.
- Browser refresh resolves account state and returns to Verify Email if an unverified account session exists.

## 11.2 Verify Email Code

### Copy

**Progress:**  
> Step 2 of 3 · Email verification

**Title:**  
> Verify your email

**Description:**  
> Enter the six-digit code sent to **{maskedEmail}**.

**Code label:**  
> Verification code

**Primary button:**  
> Verify email

**Resend disabled:**  
> Resend code in 00:59

**Resend enabled:**  
> Resend code

**Change action:**  
> Use a different email

**Help:**  
> Codes can take a few minutes to arrive. Check your spam or junk folder.

## 11.3 Email masking

Display enough context for recognition without showing the full local part.

Examples:

- `t••••@gmail.com`
- `ta••••@company.ae`
- `m••@example.com`

Rules:

- Keep domain visible
- Show the first one or two local-part characters
- Do not expose more than necessary
- The accessible label may announce the same masked value, not the full address
- A signed-in user may access full email later in Account settings; not on this screen

## 11.4 Verification-code component

### Visual anatomy

- One labelled group
- Six visually separated cells
- Desktop cell: 52 × 56 px
- Mobile cell: minimum 44 × 52 px
- Gap: 8 px desktop; 6 px mobile
- Numeric, tabular figures
- LTR ordering in all languages
- Strong focus treatment on the current cell
- Error treatment applies to the group, not six separate messages

### Interaction

- Accept digits only
- Auto-advance after each digit
- Backspace clears current cell; when empty, moves to previous
- Left/right arrows move logically through digits
- Paste of a six-digit code populates all cells
- Paste containing spaces or hyphens may be normalised if exactly six digits remain
- Full code may be entered through a single underlying accessible input
- Do not auto-submit immediately on the sixth digit; enable the Verify Email button and preserve user control
- Mobile keyboard uses numeric input
- Browser one-time-code autofill is expected
- Code is never persisted
- Code clears after invalid or expired response only when required by provider; otherwise select all for correction

### Screen-reader pattern

Preferred implementation:

- One input with label `Verification code`
- Visual cells mirror its value
- Announce `Six-digit verification code`
- Announce errors once
- Avoid six unrelated text fields that require six labels

## 11.5 Resend behaviour

- Default visual cooldown: 60 seconds
- Server-provided retry timing overrides visual timing
- Countdown uses `mm:ss`
- Countdown is announced once when it starts and when resend becomes available; do not announce every second
- Selecting Resend:
  - Disables action while sending
  - Shows `Sending new code…`
  - On success, shows a polite live-region message: `A new code has been sent.`
  - Restarts countdown
  - Clears any expired-code error
- Rate-limit errors use the server retry time when available
- Do not expose provider-specific rate-limit details

## 11.6 Verification states and copy

| State | Copy / behaviour |
|---|---|
| Code sent | `A verification code has been sent.` |
| Verifying | Button: `Verifying…`; inputs read-only |
| Invalid code | `That code is not correct. Check the six digits and try again.` |
| Expired code | `This code has expired. Request a new code to continue.` |
| Code resent | `A new verification code has been sent.` |
| Too many attempts | `Too many unsuccessful attempts. Request a new code to continue.` |
| Rate limited | `Too many requests. Please wait {time} before trying again.` |
| Provider unavailable | `We cannot verify your email right now. Your account has been created; try again shortly.` |
| Already verified | `Your email is already verified. Continue to account setup.` |
| Successful | Navigate to Email Verified and announce success |

## 11.7 Email Verified screen

**Title:**  
> Email verified

**Description:**  
> Your email is confirmed. Next, complete the demo identity step.

If profile data is missing, adapt the description:

> Your email is confirmed. We need one more account detail before the demo identity step.

**Primary button:**

- `Continue to demo identity`, or
- `Complete profile`

Do not show both. The server-resolved next step determines the action.

## 11.8 Back, refresh, and deep-link behaviour

- Back from Verify Email to Account Created is allowed.
- Back to Create Account requires `Use a different email`; do not silently abandon the created account.
- Refresh re-fetches verification state.
- If already verified, redirect forward to the next unmet onboarding requirement.
- If the verification code was opened from email in another tab, the first tab updates after refresh or next action.
- Do not allow a completed user to return to verification as an active step.

---

# 12. Customer Sign In Specification

## 12.1 Copy

**Title:**  
> Welcome back

**Description:**  
> Sign in to manage your properties, offers, and transactions.

**Fields:**

- Email address
- Password

**Primary button:**  
> Sign in

**Password link:**  
> Forgot password?

**Create-account line:**  
> New to MARKAZ? **Create account**

**Security reassurance:**  
> MARKAZ will never ask for your password by email.

## 12.2 Form behaviour

### Email

- Same trimming, direction, validation, and autocomplete rules as Create Account
- Keep email after an authentication error
- Allow browser autofill

### Password

- Label: `Password`
- Placeholder: `Enter your password`
- Autocomplete purpose: current password
- Show/hide control
- LTR in both locales
- Do not apply sign-up requirements while the user types; existing passwords may follow historical rules
- Empty password is a field error
- Clear password after incorrect credentials, suspended-account response, or provider error
- Password managers must be able to identify the form correctly

## 12.3 Submit states

| State | Behaviour |
|---|---|
| Empty form | Show required errors after submit |
| Invalid email | Field error; no request |
| Missing password | Field error; no request |
| Signing in | Button `Signing in…`; disable fields and duplicate submit |
| Incorrect credentials | Form-level generic message; keep email, clear password |
| Unverified email | Explain verification required; actions to verify or resend |
| Profile incomplete | Authenticate, then route to Complete Profile |
| UAE PASS incomplete | Authenticate, then route to current identity state |
| Suspended / unavailable account | Generic account-unavailable message; no detailed reason |
| Rate limited | Retry-time alert |
| Provider unavailable | Recoverable provider alert |
| Successful | Resolve safe destination server-side |

## 12.4 Generic credential error

> The email or password is incorrect.

Do not identify which field caused the failure.

## 12.5 Unverified-email state

Form-level alert:

**Title:**  
> Verify your email to continue

**Body:**  
> Your account setup is not complete. Enter the verification code sent to your email.

**Primary action:**  
> Verify email

**Secondary action:**  
> Resend code

This state is shown only after the user has submitted valid credentials and the provider indicates the account is unverified. It does not appear from email lookup alone.

## 12.6 Suspended or unavailable account

Use a generic message unless an approved operational reason is intentionally shared.

> We cannot sign you in to this account right now. Contact MARKAZ support if you believe this is a mistake.

Do not expose internal suspension flags or security-review detail.

## 12.7 Incomplete onboarding transition

After successful authentication, if another onboarding step is required, briefly show:

> Resuming your account setup…

Use an inline loading state for no more than the actual routing time. Do not show a fake timed delay.

Then route to the first unmet requirement with a clear status indicator.

---

# 13. Forgot Password Specification

## 13.1 Copy

**Title:**  
> Reset your password

**Description:**  
> Enter the email address for your MARKAZ account.

**Field:**  
> Email address

**Primary button:**  
> Send recovery email

**Secondary link:**  
> Return to sign in

**Security note:**  
> For your security, we will not confirm whether an account exists for this email.

## 13.2 Behaviour

- Validate only email syntax before request
- Trim whitespace
- Disable button during request
- Button copy: `Sending recovery email…`
- Regardless of account existence, navigate to generic Recovery Email Sent
- Do not vary timing intentionally in the interface
- Respect provider rate limits
- Preserve email for resend only within active session state
- Never show account-existence errors

## 13.3 Recovery Email Sent

**Title:**  
> Check your email

**Body — required:**  
> If an account exists for this email, password recovery instructions have been sent.

**Supporting copy:**  
> Open the recovery link in the email to choose a new password. Check your spam or junk folder if it does not arrive.

**Primary button:**  
> Return to sign in

**Secondary action after cooldown:**  
> Send again

**Change action:**  
> Use a different email

## 13.4 Rate-limit state

> Too many recovery requests. Please wait {time} before trying again.

The generic success statement should still be used when the provider accepts the request.

## 13.5 Provider-error state

> We could not send password recovery instructions right now. Try again shortly.

Do not imply whether an account exists.

---

# 14. Reset Password Specification

## 14.1 Entry conditions

- User arrived through a valid official Supabase recovery link/session
- Recovery session is validated before showing active password fields
- Recovery token is handled by the authentication library and never displayed

## 14.2 Copy

**Title:**  
> Choose a new password

**Description:**  
> Create a password you have not used for this account before.

**Fields:**

- New password
- Confirm new password

**Primary button:**  
> Update password

**Security reassurance:**  
> Use a unique password that you do not use on other services.

## 14.3 Password behaviour

Use the same:

- Requirements
- Checklist
- Strength treatment
- Show/hide controls
- Match validation
- Maximum length
- Accessibility
- RTL direction
- Autocomplete support

Autocomplete purpose must be new password.

## 14.4 Saving

- Validate before request
- Button changes to `Updating password…`
- Prevent duplicate requests
- On success, end the recovery session as required by the provider
- Navigate to Password Updated
- Do not automatically sign in unless explicitly approved later
- Do not restore a previous intended destination from a password-recovery link

## 14.5 Invalid or expired recovery session

**Title:**  
> This password reset link is no longer valid

**Description:**  
> The link may have expired or already been used. Request a new recovery email to continue.

**Primary button:**  
> Request a new link

**Secondary link:**  
> Return to sign in

Do not state a hard-coded expiry duration unless provider configuration is confirmed.

## 14.6 Password Updated

**Title:**  
> Password updated

**Description:**  
> Your password has been changed. Sign in with your new password.

**Primary button:**  
> Sign in

---

# 15. Profile Completion Specification

## 15.1 Purpose

Repair missing required profile data after email verification or a returning sign-in.

## 15.2 Copy

**Setup status:**  
> Account details · Action required

**Title:**  
> Complete your profile

**Description:**  
> We are missing a required account detail. Complete it to continue.

When multiple items are missing:

> We are missing a few required account details. Complete them to continue.

**Primary button:**  
> Save and continue

**Reassurance:**  
> We only ask for information needed to set up your MARKAZ account.

## 15.3 Fields

Render only missing requirements:

- Full name
- Terms checkbox
- Privacy checkbox

Email is displayed read-only if useful:

> Email address  
> `{masked or full authenticated email}` · Verified

Do not allow email editing from Profile Completion. Email change is an Account-settings feature outside this milestone.

## 15.4 Behaviour

- Pre-fill any stored valid data
- Validate only rendered fields
- Save atomically
- Button: `Saving profile…`
- On success, emit a non-sensitive profile-completed audit event
- Resolve the next onboarding state
- On refresh, re-fetch profile and route accordingly

## 15.5 Back behaviour

- Browser back may return to Sign In or the previous public page
- The next protected navigation will route back to Profile Completion until complete
- Do not allow access to dashboard or gated actions while required data remains missing

---

# 16. Simulated UAE PASS Specification

## 16.1 Product purpose

Demonstrate the future identity-verification position in the onboarding journey without connecting to or impersonating the live UAE PASS service.

## 16.2 Required persistent disclosure

Use a small pale-blue information panel near the top of every UAE PASS state:

**Badge:**  
> Demo simulation

**Disclosure — required:**  
> Demo simulation only.  
> This prototype is not connected to the live UAE PASS service.

The disclosure remains visible but should not dominate the page:

- Pale blue surface
- Information icon
- 14 px body text
- No warning-red styling
- No government crest, UAE PASS logo, or official colours

## 16.3 State model

| Status | Meaning | User destination |
|---|---|---|
| `NOT_STARTED` | User has not started the demo step | Introduction |
| `PENDING` | Demo check started and awaits selected result | Pending |
| `VERIFIED_DEMO` | Demo outcome approved | Success / Dashboard |
| `FAILED_DEMO` | Demo outcome rejected | Failure / Retry |

## 16.4 Introduction

**Progress:**  
> Step 3 of 3 · Demo identity

**Title:**  
> Verify your identity for this demo

**Description:**  
> This prototype includes a simulated identity step so you can experience the complete MARKAZ onboarding journey.

**What happens panel:**

> In this demo, we will:
>
> - Start a simulated identity check
> - Show a pending state
> - Record a demo result

**Primary button:**  
> Start demo verification

**Secondary action:**  
> Sign out

Do not request Emirates ID, passport, camera, selfie, biometric, date of birth, or nationality.

## 16.5 Pending

**Title:**  
> Demo verification in progress

**Description:**  
> Your demo identity check has started. Use the simulation controls below to choose the result.

**Status chip:**  
> Pending · Demo

### Demo simulation controls

Place in a distinct, dashed or pale-blue panel below the status content.

**Panel title:**  
> Demo simulation controls

**Panel description:**  
> These controls are available only in the prototype and do not connect to UAE PASS.

**Primary button:**  
> Approve demo verification

**Secondary button:**  
> Reject

The two actions may be visually distinct because they control the demo outcome:

- Approve: primary blue
- Reject: neutral outline, not destructive red
- On selection, disable both and show saving state
- Do not auto-resolve without interaction unless a seeded demo scenario explicitly requires it

## 16.6 Success

**Title — required:**  
> Demo identity verified

**Description:**  
> Your account setup is complete. You can now browse properties, make offers, and list a property.

**Status chip:**  
> Verified · Demo

**Primary button:**  
> Go to dashboard

If a safe intended destination exists:

> Continue

and supporting copy:

> You will return to the page you were trying to access.

The demo disclosure remains visible.

## 16.7 Failure

**Title:**  
> Demo verification was not completed

**Description:**  
> No official identity check was performed. Try the simulation again to continue.

**Status chip:**  
> Unsuccessful · Demo

**Primary button:**  
> Try again

**Secondary action:**  
> Sign out

Do not use words such as “fraud”, “rejected by UAE PASS”, or “identity failed”.

## 16.8 Refresh and resume

- `PENDING` refreshes to Pending
- `FAILED_DEMO` refreshes to Failure
- `VERIFIED_DEMO` redirects forward to dashboard or safe destination
- Starting again from failure updates the same identity record according to domain rules; do not create uncontrolled duplicates
- Browser back from success must not return to active pending controls
- State is server-backed and must not depend on local UI memory

---

# 17. Session and Sign Out Specification

## 17.1 Sign Out item

Location:

- Customer account menu
- Admin account menu

Copy:

> Sign out

An icon may accompany the text but must not replace it.

### Behaviour

- One selection initiates sign out
- Menu closes
- Show a short loading state if required
- Clear authentication cookies/session through supported provider flow
- Clear sensitive in-memory form values
- Clear stale protected `returnTo` values
- Do not clear ordinary public preferences such as locale
- Redirect to Signed-Out confirmation

A confirmation dialog is not required for normal sign out. Unsaved-work confirmation belongs to the relevant product flow, not the account-menu component.

## 17.2 Customer Signed Out

**Title:**  
> You are signed out

**Description:**  
> Your MARKAZ session has ended.

**Primary button:**  
> Sign in

**Secondary button:**  
> Browse properties

## 17.3 Session Expired

Use the Sign In shell with a notice above the form.

**Notice title:**  
> Your session has expired

**Notice body:**  
> For your security, please sign in again. We will return you to a safe page where possible.

The form title remains:

> Welcome back

### Safe return rule

- Preserve only an allowlisted relative customer route
- Never accept an arbitrary external URL
- Never return to reset-password or verification-token routes
- Never return to Admin from the customer application
- If the target is unavailable or unsafe, route to Dashboard
- Do not preserve unsaved password or verification-code input

## 17.4 Browser and multi-tab behaviour

- Signing out in one tab invalidates protected sessions in other tabs on next request/session event
- Other tabs show Session Expired rather than a broken page
- Do not repeatedly redirect between Sign In and a protected route
- After successful sign-in, consume the return destination once

---

# 18. Admin Authentication Specification

## 18.1 Admin shell

Admin authentication must look related to MARKAZ but operationally distinct.

### Desktop

- Split layout or centred 440 px form
- Deep Architectural Blue side panel or top band
- MARKAZ logo plus `OPERATIONS`
- `Authorised access only` label
- No property-marketplace navigation
- No Create Account
- No List a Property action
- Language control available

### Mobile

- Full-width form
- Compact Operations branding
- No side panel
- Authorised-access label remains

## 18.2 Admin Sign In

**Brand label:**  
> MARKAZ Operations

**Eyebrow:**  
> Authorised access only

**Title:**  
> Sign in to Operations

**Description:**  
> Use your authorised MARKAZ Admin account.

**Fields:**

- Email address
- Password

**Primary button:**  
> Sign in

**Link:**  
> Forgot password?

**Security note:**  
> Access is restricted to authorised MARKAZ personnel.

Use the same generic credential error:

> The email or password is incorrect.

Do not include a Create Account link.

## 18.3 Account-type check

After successful provider authentication:

1. Validate `account_type` server-side.
2. If `ADMIN`, continue to Admin Overview.
3. If not `ADMIN`, navigate to Access Denied.
4. Do not briefly render the Admin shell or data before the check completes.
5. Record the access-denied event without storing credentials or tokens.

## 18.4 Admin Access Denied

**Title:**  
> Access denied

**Description:**  
> This account does not have permission to access MARKAZ Operations.

**Supporting copy:**  
> Sign out and use an authorised Admin account.

**Primary button:**  
> Sign out

**Secondary link:**  
> Return to MARKAZ Home

Do not offer Admin registration or role elevation.

## 18.5 Admin Forgot Password

**Title:**  
> Reset your Admin password

**Description:**  
> Enter the email address for your authorised MARKAZ Admin account.

**Primary button:**  
> Send recovery email

**Secondary link:**  
> Return to Admin sign in

Use the same generic confirmation:

> If an account exists for this email, password recovery instructions have been sent.

## 18.6 Admin Reset Password

Use the shared password rules and recovery-session handling.

**Title:**  
> Choose a new Admin password

**Description:**  
> Create a secure password for your MARKAZ Operations account.

**Primary button:**  
> Update password

## 18.7 Admin Password Updated

**Title:**  
> Password updated

**Description:**  
> Your Admin password has been changed. Sign in with your new password.

**Primary button:**  
> Return to Admin sign in

## 18.8 Admin Session Expired

**Notice title:**  
> Your Admin session has expired

**Notice body:**  
> For security, sign in again to continue using MARKAZ Operations.

Do not restore a route unless it is an allowlisted Admin route and the account-type check succeeds again.

## 18.9 Admin Signed Out

**Title:**  
> You are signed out of MARKAZ Operations

**Description:**  
> Your Admin session has ended.

**Primary button:**  
> Return to Admin sign in


---

# 19. Component Library

## 19.1 Authentication Page Shell

| Attribute | Specification |
|---|---|
| Purpose | Provides consistent header, main layout, footer, optional support panel, and locale direction |
| Anatomy | Brand header, main landmark, form region, optional supporting panel, legal footer |
| Variants | Customer split, customer centred, Admin split, Admin centred, status-only |
| States | Normal, loading route, provider unavailable, RTL |
| Interaction | Maintains focus within page flow; no modal trapping |
| Accessibility | One `main`; skip link; one page-level `h1`; landmarks labelled |
| RTL | Grid may mirror; content logical order remains form then support for screen readers |
| Responsive | Support panel hides below 1024 px |
| Reuse | All authentication, recovery, onboarding, and access states |

## 19.2 Authentication Form Container

| Attribute | Specification |
|---|---|
| Purpose | Groups heading, description, alerts, fields, and actions |
| Anatomy | Progress, heading block, alert slot, form body, action area, support links |
| Variants | Borderless, subtle bordered, status panel |
| States | Default, submitting, success, error |
| Interaction | Error summary receives focus after invalid submission |
| Accessibility | Form has accessible name from heading; help and errors associated |
| RTL | Text aligns to logical start |
| Responsive | Full width on mobile; max 480–520 px desktop |
| Reuse | Sign Up, Sign In, Forgot, Reset, Profile |

## 19.3 Brand Header

| Attribute | Specification |
|---|---|
| Purpose | Provides trusted product identity and locale control |
| Anatomy | Logo, optional application label, language switcher, return-home link |
| Variants | Customer, Operations, compact |
| States | Default, dark-surface |
| Interaction | Logo returns to correct application home |
| Accessibility | Descriptive logo alt text; active locale announced |
| RTL | Logo at logical start; controls at logical end |
| Responsive | Compact wordmark on mobile |
| Reuse | All auth shells |

## 19.4 Email Input

| Attribute | Specification |
|---|---|
| Purpose | Collects sign-up, sign-in, and recovery email |
| Anatomy | Label, control, optional helper, error, optional verified state |
| Variants | Editable, read-only verified |
| States | Empty, focus, valid, invalid, disabled, autofilled |
| Interaction | Trim outer whitespace on blur/submit; never expose account existence |
| Accessibility | Persistent label; described-by relationship; error announced |
| RTL | Input text and caret remain LTR; label aligns to locale |
| Responsive | 48 px minimum height |
| Reuse | Customer and Admin auth |

## 19.5 Password Input

| Attribute | Specification |
|---|---|
| Purpose | Secure password entry |
| Anatomy | Label, password field, show/hide control, helper/error |
| Variants | Current password, new password, confirm password |
| States | Default, focus, visible, invalid, disabled, autofilled |
| Interaction | Show/hide retains focus and caret; does not clear value |
| Accessibility | Toggle label changes between `Show password` and `Hide password`; pressed state exposed |
| RTL | Password characters and caret remain LTR; toggle at logical end of field |
| Responsive | 48 px minimum; toggle 44 px hit target |
| Reuse | Sign Up, Sign In, Reset |

## 19.6 Password Requirements Checklist

| Attribute | Specification |
|---|---|
| Purpose | Makes baseline requirements visible while creating/resetting password |
| Anatomy | Intro label plus five requirement rows |
| Variants | Neutral, partially met, all met, submitted error |
| States | Hidden empty, visible focus, mixed, complete |
| Interaction | Updates live without stealing focus |
| Accessibility | One polite summary announcement when all requirements become met; do not announce every keystroke |
| RTL | Icons at logical start of each row |
| Responsive | Stacks naturally below password |
| Reuse | Sign Up, Reset, Admin Reset |

## 19.7 Password Strength Indicator

| Attribute | Specification |
|---|---|
| Purpose | Supplementary guidance beyond blocking requirements |
| Anatomy | Three restrained segments and text label |
| Variants | Incomplete, meets, strong |
| States | Hidden empty; live update |
| Interaction | No animation beyond subtle colour change |
| Accessibility | Text communicates level; bar is decorative or labelled |
| RTL | Segment filling follows reading direction visually, but label is authoritative |
| Responsive | Full control width |
| Reuse | Sign Up and Reset |

## 19.8 Verification Code Input

| Attribute | Specification |
|---|---|
| Purpose | Collects six-digit email-verification code |
| Anatomy | Group label, single logical input, six visual cells, error |
| Variants | Default, filled, invalid, expired, disabled |
| States | Focused digit, complete, verifying |
| Interaction | Auto-advance, backspace, arrows, full-code paste |
| Accessibility | Single accessible input; one-time-code semantics; numeric description |
| RTL | Digits remain LTR and ordered 1–6 |
| Responsive | Cells shrink to minimum 44 px with 6 px gaps |
| Reuse | Customer email verification only unless future approved use |

## 19.9 Legal Checkbox with Linked Text

| Attribute | Specification |
|---|---|
| Purpose | Records separate Terms and Privacy consent |
| Anatomy | Checkbox, sentence, inline legal link, error |
| Variants | Terms, Privacy |
| States | Unchecked, focus, checked, invalid, disabled |
| Interaction | Whole label toggles except link; link opens new tab without toggling |
| Accessibility | Native/accessible checkbox; link announces new tab |
| RTL | Checkbox at logical start; text flows RTL |
| Responsive | Wrapped text remains aligned |
| Reuse | Sign Up and Profile Completion |

## 19.10 Primary Button

| Attribute | Specification |
|---|---|
| Purpose | Dominant screen action |
| Anatomy | Label, optional leading spinner |
| Variants | Standard, destructive only where explicitly approved |
| States | Default, hover, focus, active, disabled, loading |
| Interaction | Prevents double submit while loading |
| Accessibility | Minimum 44 px; loading announced; label remains meaningful |
| RTL | Icon position uses logical start |
| Responsive | Full width on mobile; form width on desktop |
| Reuse | All auth screens |

## 19.11 Secondary Button

| Attribute | Specification |
|---|---|
| Purpose | Non-dominant alternative action |
| Anatomy | Label, optional icon |
| Variants | Outline, quiet |
| States | Standard interactive states |
| Interaction | Never competes visually with primary action |
| Accessibility | Same target and focus requirements |
| RTL | Logical icon positioning |
| Responsive | Full width below primary when paired on mobile |
| Reuse | Back, Browse, Reject demo, Return home |

## 19.12 Text Link

| Attribute | Specification |
|---|---|
| Purpose | Low-emphasis navigation or recovery action |
| Anatomy | Descriptive text with optional icon |
| Variants | Inline, standalone, external |
| States | Default, hover, focus, visited where appropriate |
| Interaction | External legal links preserve form |
| Accessibility | Never use `Click here`; visible focus; external intent announced |
| RTL | Arrow mirrors when directional |
| Responsive | 44 px effective touch area for standalone links |
| Reuse | Sign In, Create Account, Forgot, change email |

## 19.13 Inline Field Error

| Attribute | Specification |
|---|---|
| Purpose | Explains a field-specific problem |
| Anatomy | Error icon, concise text |
| Variants | Error, warning only when non-blocking |
| States | Appears on blur or submit according to field rule |
| Interaction | Clears when field becomes valid; not merely on focus |
| Accessibility | Associated through described-by; invalid state exposed |
| RTL | Icon at logical start; text logical alignment |
| Responsive | Wraps beneath field |
| Reuse | All forms |

## 19.14 Form-Level Alert

| Attribute | Specification |
|---|---|
| Purpose | Communicates account, provider, rate-limit, or cross-field failure |
| Anatomy | Icon, title, body, optional actions |
| Variants | Error, warning, information |
| States | Static, dismissible only when safe |
| Interaction | Receives focus after failed server submission |
| Accessibility | Alert semantics for immediate errors; avoid repeated announcements |
| RTL | Logical alignment and action order |
| Responsive | Actions stack on mobile |
| Reuse | Duplicate safe, credentials, unverified, provider, rate limit |

## 19.15 Loading Button

| Attribute | Specification |
|---|---|
| Purpose | Shows an in-progress action without layout shift |
| Anatomy | Spinner, progressive label |
| Variants | Primary and secondary |
| States | Loading only |
| Interaction | Disabled from repeat clicks; retains width |
| Accessibility | Busy state; polite status text |
| RTL | Spinner at logical start |
| Responsive | Full width where parent button is full width |
| Reuse | All submissions |

## 19.16 Success Panel

| Attribute | Specification |
|---|---|
| Purpose | Confirms completion and next step |
| Anatomy | Success icon, title, body, action |
| Variants | Email verified, password updated, identity verified, signed out |
| States | Static |
| Interaction | Focus moves to heading after navigation |
| Accessibility | Icon decorative; success conveyed in text |
| RTL | Logical alignment |
| Responsive | Max 520 px; action full width mobile |
| Reuse | All success screens |

## 19.17 Error Panel

| Attribute | Specification |
|---|---|
| Purpose | Handles blocking but recoverable failure |
| Anatomy | Error icon, title, body, primary recovery, secondary exit, reference ID optional |
| Variants | Provider unavailable, unexpected, invalid recovery |
| States | Static or retrying |
| Interaction | Retry uses loading state |
| Accessibility | Heading focused after navigation |
| RTL | Logical alignment |
| Responsive | Max 520 px |
| Reuse | Global auth errors |

## 19.18 Simulation Badge

| Attribute | Specification |
|---|---|
| Purpose | Prevents confusion between demo and official identity verification |
| Anatomy | Information icon and `Demo simulation` text |
| Variants | Neutral demo, pending demo, verified demo, unsuccessful demo |
| States | Mirrors identity state without becoming an official seal |
| Interaction | Non-interactive |
| Accessibility | Full status text exposed |
| RTL | Icon at logical start |
| Responsive | Wraps; never truncates |
| Reuse | All UAE PASS states |

## 19.19 Authentication Progress Indicator

| Attribute | Specification |
|---|---|
| Purpose | Explains account-setup progress |
| Anatomy | Three milestones or compact step label |
| Variants | Linear new flow, setup-status resume |
| States | Complete, current, upcoming, action required |
| Interaction | Non-clickable; prevents skipping |
| Accessibility | Ordered list with current step |
| RTL | Visual order mirrors; semantic order remains correct for locale |
| Responsive | Compact label + line on mobile |
| Reuse | Sign Up, Verify, Profile, UAE PASS |

## 19.20 Resend Countdown

| Attribute | Specification |
|---|---|
| Purpose | Communicates when a new code/request may be sent |
| Anatomy | Disabled action with time, enabled action |
| Variants | Verification, recovery |
| States | Counting, available, sending, rate limited |
| Interaction | Server retry time governs |
| Accessibility | Do not announce every second; announce availability |
| RTL | Time digits remain LTR |
| Responsive | Inline or own row mobile |
| Reuse | Verify and recovery confirmation |

## 19.21 Session-Expired Notice

| Attribute | Specification |
|---|---|
| Purpose | Explains why re-authentication is required |
| Anatomy | Info icon, title, explanation |
| Variants | Customer, Admin |
| States | Static |
| Interaction | Does not dismiss until sign-in or navigation away |
| Accessibility | Read before form through DOM order |
| RTL | Logical alignment |
| Responsive | Full form width |
| Reuse | Customer and Admin Sign In |

## 19.22 Access-Denied State

| Attribute | Specification |
|---|---|
| Purpose | Blocks non-Admin account from Operations |
| Anatomy | Lock icon, heading, explanation, Sign Out, return link |
| Variants | Admin only |
| States | Static, signing out |
| Interaction | No route into portal |
| Accessibility | Focus heading; clear button labels |
| RTL | Logical order |
| Responsive | Centred max 520 px |
| Reuse | Admin account-type denial |

## 19.23 Account Menu Sign Out Item

| Attribute | Specification |
|---|---|
| Purpose | Ends active session |
| Anatomy | Sign-out icon, text |
| Variants | Customer, Admin |
| States | Default, hover, focus, loading |
| Interaction | Immediate sign out; close menu; navigate to confirmation |
| Accessibility | Menuitem semantics; keyboard activation |
| RTL | Icon at logical start |
| Responsive | Works in desktop menu and mobile account sheet |
| Reuse | Both applications |

---

# 20. Form and Validation Matrix

All messages below are approved English product copy. Arabic status indicates required review before release.

| Field / state | Trigger | English message | Placement | Clears when | Submit allowed? | Arabic review |
|---|---|---|---|---|---|---|
| Full name empty | Blur after interaction or submit | `Enter your full name.` | Under field | Non-empty valid value | No | Language review |
| Full name too short | Blur or submit; trimmed length < 2 | `Enter at least 2 characters.` | Under field | Length ≥ 2 | No | Language review |
| Full name too long | Input/submit; length > 100 | `Full name must be 100 characters or fewer.` | Under field | Length ≤ 100 | No | Language review |
| Email empty | Blur after interaction or submit | `Enter your email address.` | Under field | Non-empty | No | Language review |
| Email invalid | Blur or submit | `Enter a valid email address.` | Under field | Valid syntax | No | Language review |
| Email whitespace | Leading/trailing whitespace | No error; trim on blur/submission | Control value | Normalised | Yes if otherwise valid | N/A |
| Existing-account-safe failure | Sign-up server response | `We could not create a new account with these details. You may already have an account. Try signing in or resetting your password.` | Form alert | User edits details or navigates | No pending retry | Security + language review |
| Password empty | Submit or blur after interaction | `Enter a password.` | Under field | Non-empty | No | Language review |
| Password too short | Checklist/live and submit | `Use at least 8 characters.` | Checklist and error | Requirement met | No | Language review |
| Uppercase missing | Checklist/live and submit | `Add at least one uppercase letter.` | Checklist | Requirement met | No | Language review |
| Lowercase missing | Checklist/live and submit | `Add at least one lowercase letter.` | Checklist | Requirement met | No | Language review |
| Number missing | Checklist/live and submit | `Add at least one number.` | Checklist | Requirement met | No | Language review |
| Special missing | Checklist/live and submit | `Add at least one special character.` | Checklist | Requirement met | No | Language review |
| Password too long | Input/submit > 128 | `Password must be 128 characters or fewer.` | Under field | Length ≤ 128 | No | Language review |
| Confirm password empty | Submit or blur after password entered | `Confirm your password.` | Under field | Non-empty | No | Language review |
| Password mismatch | Confirm blur or submit | `Passwords do not match.` | Under confirm field | Exact match | No | Language review |
| Terms not accepted | Submit | `Accept the Terms of Use to create an account.` | Under checkbox | Checked | No | Legal + language review |
| Privacy not accepted | Submit | `Accept the Privacy Policy to create an account.` | Under checkbox | Checked | No | Legal + language review |
| Incorrect credentials | Sign-in response | `The email or password is incorrect.` | Form alert | New submit / edit | No | Security + language review |
| Email unverified | Sign-in state resolution | `Verify your email to continue.` | Form alert | Verification complete | No protected access | Language review |
| Verification code empty | Submit | `Enter the six-digit verification code.` | Under code group | Six digits entered | No | Language review |
| Verification code incomplete | Submit with 1–5 digits | `Enter all six digits.` | Under code group | Six digits | No | Language review |
| Invalid verification code | Provider response | `That code is not correct. Check the six digits and try again.` | Under code group + summary | New valid verification | No | Security + language review |
| Expired verification code | Provider response | `This code has expired. Request a new code to continue.` | Form alert | New code sent | No | Security + language review |
| Too many code attempts | Provider/rule response | `Too many unsuccessful attempts. Request a new code to continue.` | Form alert | New code sent / cooldown | No | Security + language review |
| Rate limited | Provider response | `Too many requests. Please wait {time} before trying again.` | Form alert | Retry time reached | No until retry | Security + language review |
| Provider unavailable | Provider/network response | `The authentication service is temporarily unavailable. Try again shortly.` | Form alert or Error Panel | Retry succeeds | No | Language review |
| Account unavailable | Auth response | `We cannot sign you in to this account right now. Contact MARKAZ support if you believe this is a mistake.` | Form alert | Support resolution | No | Security + language review |
| Recovery email invalid | Client validation | `Enter a valid email address.` | Under field | Valid | No | Language review |
| Invalid recovery session | Missing/invalid token/session | `This password reset link is no longer valid.` | Error panel | New valid link | No | Security + language review |
| Expired recovery session | Provider response | `The link may have expired or already been used. Request a new recovery email to continue.` | Error panel | New valid link | No | Security + language review |
| Expired session | Protected request/session event | `Your session has expired. Sign in again to continue.` | Notice above Sign In | New session | No protected access | Security + language review |
| Admin access denied | Authenticated non-Admin | `This account does not have permission to access MARKAZ Operations.` | Access Denied panel | Admin sign-in | No | Security + language review |
| Unexpected error | Unclassified safe error | `We could not complete this request. Try again.` | Error panel | Retry succeeds | No | Language review |

## 20.1 Validation timing summary

- Required-field errors: on submit; also on blur after the field has been interacted with
- Email syntax: on blur and submit
- Full-name length: on blur and submit
- Password requirements: live checklist after focus; blocking error on submit
- Confirm-password mismatch: on confirm blur and submit
- Legal checkboxes: on submit
- Server errors: after response, at form level
- Errors clear only when the underlying condition is resolved, not merely when focus returns

---

# 21. Loading, Success, and Error Patterns

## 21.1 Loading

### Button loading

Use progressive labels:

- `Creating account…`
- `Signing in…`
- `Sending code…`
- `Verifying…`
- `Sending recovery email…`
- `Updating password…`
- `Saving profile…`
- `Starting demo verification…`
- `Saving demo result…`
- `Signing out…`

Rules:

- Keep original button width
- Disable repeat action
- Do not disable unrelated navigation unless leaving would corrupt the request
- Use spinner plus text
- Announce status politely
- Do not use full-page spinner for ordinary form submission

### Route-resolution loading

Copy:

> Checking your account setup…

Use a centred, restrained status for genuine state resolution only. If resolution exceeds 10 seconds, show:

> This is taking longer than expected.

and a `Try again` action.

## 21.2 Success

Success screens use:

- Small success icon
- Clear past-tense title
- One sentence explaining result
- One next action
- No confetti
- No animated celebration
- Focus moved to the success heading

## 21.3 Inline errors

Use for:

- Required fields
- Syntax
- Length
- Password requirements
- Password mismatch
- Legal acceptance
- Verification-code format

## 21.4 Form-level alerts

Use for:

- Duplicate-safe sign-up response
- Incorrect credentials
- Unverified email
- Account unavailable
- Provider failure
- Rate limit
- Too many verification attempts

## 21.5 Blocking error screens

Use for:

- Persistent provider unavailable
- Invalid recovery session
- Unexpected route-level failure
- Admin access denied

## 21.6 Error reference

For unexpected server errors only, an optional short support reference may be shown:

> Reference: `ABC-1234`

It must not contain user data, tokens, provider messages, stack traces, database IDs, or credentials.

---

# 22. Responsive Behaviour

## 22.1 Breakpoints

Use the project’s shared Tailwind breakpoints, with these behavioural targets:

- Mobile: < 768 px
- Tablet: 768–1023 px
- Desktop: 1024–1439 px
- Wide desktop: ≥ 1440 px

Do not create auth-specific breakpoint values unless required by the shared design system.

## 22.2 Desktop

- Split layout allowed
- Header fixed only if it does not reduce usable vertical space on shorter screens
- Form remains max 480–520 px
- Long Create Account page may scroll
- Support panel may be sticky within viewport if implemented without trapping scroll
- Footer appears after content, not fixed over fields

## 22.3 Tablet

- One-column form
- Hide support panel
- Keep max 520 px
- Progress remains horizontal if it fits; otherwise compact
- Centre form in available width

## 22.4 Mobile

- Full-width content
- No floating card
- 24 px inline padding
- Full-width primary button
- Secondary button below primary
- Standalone links have minimum 44 px touch area
- Verification cells fit 320 px viewport
- Legal rows wrap cleanly
- Password checklist remains visible
- Footer links wrap into two or more lines
- No horizontal scroll
- Soft keyboard must not cover active input or error
- Focused fields must remain visible beneath browser chrome

## 22.5 Short-height desktop

At viewport heights below approximately 720 px:

- Top-align form with 32 px top padding
- Allow natural page scroll
- Do not vertically centre a long sign-up form
- Supporting panel remains within content height rather than fixed full-screen

## 22.6 Zoom and text resizing

- Layout must work at 200% browser zoom
- Text must reflow without clipping
- Verification code and buttons must not overlap
- Do not use fixed-height containers for error text
- Do not truncate security or legal copy

---

# 23. Arabic and RTL Behaviour

## 23.1 Global direction

- Set document direction from active locale
- Arabic pages use RTL layout
- Use logical properties: inline-start, inline-end, margin-inline, padding-inline
- Do not hard-code visual left/right positions

## 23.2 What mirrors

- Header alignment
- Form alignment
- Support-panel placement
- Directional arrows
- Back arrow
- Progress-indicator visual direction
- Inline icons associated with reading flow
- Checkbox and label order
- Form-alert and panel alignment
- Button icon positions

## 23.3 What remains LTR

The following remain LTR even in Arabic:

- Email-address value and caret
- Password value and caret
- Verification-code digits
- Countdown digits
- URLs
- Support reference IDs
- Technical status identifiers when shown internally
- Version/build labels

Use bidirectional isolation so LTR values do not disrupt Arabic sentences.

## 23.4 Email input

- Label and helper copy RTL
- Input value direction LTR
- Text alignment follows LTR for the value
- Error copy aligns to logical start of Arabic form
- Masked email remains LTR

## 23.5 Password input

- Password value LTR
- Show/hide control stays at logical end of the input container
- Arabic label and helper RTL
- Requirement list RTL, while Latin uppercase/lowercase examples are isolated if used

## 23.6 Verification code

- Digits displayed left-to-right in logical numerical order
- The overall labelled group sits within RTL page flow
- Pasting works regardless of page direction
- Screen-reader label is Arabic, but digit order is LTR
- Countdown `00:59` remains LTR

## 23.7 Checkbox and legal links

- Checkbox appears at logical start of Arabic row
- Text flows RTL
- Inline Terms and Privacy links remain part of the Arabic sentence
- External-link icon appears after the link in reading order
- Legal Arabic copy requires legal and professional-language review

## 23.8 Back navigation

- Arrow mirrors in RTL
- Accessible name remains `Back` / Arabic equivalent
- Browser back behaviour is unchanged

## 23.9 Progress

- Visual milestones flow from right to left in Arabic
- Ordered semantics follow Arabic reading order
- Completed/current/upcoming labels remain textually explicit
- Mobile progress line may fill from the right in RTL

## 23.10 Mobile Arabic

- Do not reduce font size to fit longer Arabic text
- Allow buttons to wrap to two lines only when unavoidable; increase height naturally
- Keep full-width controls
- Verify on real 320 px and 360 px widths
- Avoid letter spacing on Arabic text
- Use an Arabic-capable UI font approved by the shared design system

---

# 24. Accessibility Requirements

Target WCAG 2.2 AA.

## 24.1 Page structure

- One `h1` per screen
- Logical heading order
- Header, main, and footer landmarks
- Skip link to main content
- Page title updates for every route
- Focus moves to `h1` or primary error heading after route navigation

## 24.2 Form labels

- Every control has a persistent visible label
- Placeholder is supplementary, never the only label
- Required fields are indicated in text or accessible metadata
- Do not use colour alone for required or invalid state

## 24.3 Descriptions and errors

- Helper and error IDs connect through described-by relationships
- Invalid controls expose invalid state
- Multi-error submit creates an error summary
- Error-summary links move focus to the field
- Server alerts use appropriate live-region semantics
- Do not announce the same error multiple times

## 24.4 Keyboard

- All controls reachable in logical order
- Enter submits a valid form
- Space activates checkboxes and buttons
- Password visibility controls are keyboard accessible
- OTP arrow and backspace behaviour works without trapping Tab
- No custom component captures global shortcuts
- Visible focus has minimum 2 px contrast treatment

## 24.5 Screen reader

- Loading status is announced
- Success and failure state headings are announced after navigation
- OTP is one logical input
- Password requirement changes are not announced on every character
- Final `All password requirements met` may be announced once
- Masked email is read logically
- Language names are correctly tagged

## 24.6 Colour and contrast

- Body text meets 4.5:1
- Large text meets 3:1
- UI boundaries and focus indicators meet 3:1 against adjacent colours
- Disabled state remains understandable
- Error and success states include icon and text

## 24.7 Touch targets

- Buttons, standalone links, checkbox rows, and icon toggles: at least 44 × 44 px
- OTP cells: minimum 44 px wide and 52 px high on mobile
- Language switcher meets target size

## 24.8 Reduced motion

- Respect reduced-motion preference
- Remove progress animations, panel fades, and spinner rotation alternatives where necessary
- Never rely on motion to communicate state

## 24.9 Autofill and password managers

Expected semantic purposes:

- Full name: name
- Email: email / username where required by manager
- Sign-in password: current password
- New/reset password: new password
- Verification code: one-time code

Additional requirements:

- Do not block paste
- Do not disable password-manager overlays
- Keep username/email and password in the same logical form on Sign In
- Do not use misleading hidden fields
- Autofill styling must remain legible
- Password visibility toggle must not change autocomplete semantics

## 24.10 Time-based states

- Resend countdown is not announced every second
- Show a clear available state when countdown ends
- If a server retry time is known, display it
- Do not require the user to act within an unnecessarily short UI-only timeout


---

# 25. Exact English Copy

This section is the master English copy reference. Screen sections remain authoritative for contextual variants.

## 25.1 Navigation and common actions

| Key | English |
|---|---|
| `auth.signIn` | Sign in |
| `auth.createAccount` | Create account |
| `auth.signOut` | Sign out |
| `auth.returnHome` | Back to MARKAZ Home |
| `auth.tryAgain` | Try again |
| `auth.continue` | Continue |
| `auth.cancel` | Cancel |
| `auth.back` | Back |
| `auth.languageEnglish` | English |
| `auth.languageArabic` | العربية |

## 25.2 Create Account

| Key | English |
|---|---|
| `signup.title` | Create your MARKAZ account |
| `signup.description` | One account lets you browse properties, make offers, list a property, and track transactions. |
| `signup.fullName` | Full name |
| `signup.fullNamePlaceholder` | Enter your full name |
| `signup.email` | Email address |
| `signup.emailPlaceholder` | you@example.com |
| `signup.password` | Password |
| `signup.passwordPlaceholder` | Create a password |
| `signup.confirmPassword` | Confirm password |
| `signup.confirmPasswordPlaceholder` | Re-enter your password |
| `signup.terms` | I agree to the Terms of Use. |
| `signup.privacy` | I agree to the Privacy Policy. |
| `signup.submit` | Create account |
| `signup.submitting` | Creating account… |
| `signup.existing` | Already have an account? |
| `signup.security` | Your account details are protected using secure authentication. |

## 25.3 Password

| Key | English |
|---|---|
| `password.show` | Show password |
| `password.hide` | Hide password |
| `password.requirementsTitle` | Your password must include: |
| `password.length` | At least 8 characters |
| `password.uppercase` | One uppercase letter |
| `password.lowercase` | One lowercase letter |
| `password.number` | One number |
| `password.special` | One special character |
| `password.incomplete` | Does not yet meet the requirements |
| `password.meets` | Meets the requirements |
| `password.strong` | Strong password |
| `password.unique` | Use a unique password that you do not use on other services. |

## 25.4 Verification

| Key | English |
|---|---|
| `verify.checkEmailTitle` | Check your email |
| `verify.sentCode` | We sent a six-digit verification code to {email}. |
| `verify.checkEmailBody` | Enter the code to verify your email and continue setting up your account. |
| `verify.enterCode` | Enter verification code |
| `verify.title` | Verify your email |
| `verify.description` | Enter the six-digit code sent to {email}. |
| `verify.codeLabel` | Verification code |
| `verify.submit` | Verify email |
| `verify.submitting` | Verifying… |
| `verify.resend` | Resend code |
| `verify.resendIn` | Resend code in {time} |
| `verify.resending` | Sending new code… |
| `verify.changeEmail` | Use a different email |
| `verify.help` | Codes can take a few minutes to arrive. Check your spam or junk folder. |
| `verify.resent` | A new verification code has been sent. |
| `verify.successTitle` | Email verified |
| `verify.successBody` | Your email is confirmed. Next, complete the demo identity step. |
| `verify.continueIdentity` | Continue to demo identity |
| `verify.completeProfile` | Complete profile |

## 25.5 Sign In

| Key | English |
|---|---|
| `signin.title` | Welcome back |
| `signin.description` | Sign in to manage your properties, offers, and transactions. |
| `signin.passwordPlaceholder` | Enter your password |
| `signin.submit` | Sign in |
| `signin.submitting` | Signing in… |
| `signin.forgot` | Forgot password? |
| `signin.new` | New to MARKAZ? |
| `signin.security` | MARKAZ will never ask for your password by email. |
| `signin.incorrect` | The email or password is incorrect. |
| `signin.verifyTitle` | Verify your email to continue |
| `signin.verifyBody` | Your account setup is not complete. Enter the verification code sent to your email. |
| `signin.resuming` | Resuming your account setup… |

## 25.6 Recovery

| Key | English |
|---|---|
| `forgot.title` | Reset your password |
| `forgot.description` | Enter the email address for your MARKAZ account. |
| `forgot.submit` | Send recovery email |
| `forgot.submitting` | Sending recovery email… |
| `forgot.return` | Return to sign in |
| `forgot.security` | For your security, we will not confirm whether an account exists for this email. |
| `forgot.sentTitle` | Check your email |
| `forgot.sentBody` | If an account exists for this email, password recovery instructions have been sent. |
| `forgot.sentHelp` | Open the recovery link in the email to choose a new password. Check your spam or junk folder if it does not arrive. |
| `forgot.sendAgain` | Send again |
| `forgot.changeEmail` | Use a different email |
| `reset.title` | Choose a new password |
| `reset.description` | Create a password you have not used for this account before. |
| `reset.newPassword` | New password |
| `reset.confirm` | Confirm new password |
| `reset.submit` | Update password |
| `reset.submitting` | Updating password… |
| `reset.invalidTitle` | This password reset link is no longer valid |
| `reset.invalidBody` | The link may have expired or already been used. Request a new recovery email to continue. |
| `reset.requestNew` | Request a new link |
| `reset.successTitle` | Password updated |
| `reset.successBody` | Your password has been changed. Sign in with your new password. |

## 25.7 Profile

| Key | English |
|---|---|
| `profile.title` | Complete your profile |
| `profile.descriptionOne` | We are missing a required account detail. Complete it to continue. |
| `profile.descriptionMany` | We are missing a few required account details. Complete them to continue. |
| `profile.submit` | Save and continue |
| `profile.submitting` | Saving profile… |
| `profile.reassurance` | We only ask for information needed to set up your MARKAZ account. |
| `profile.verifiedEmail` | Verified |

## 25.8 Simulated UAE PASS

| Key | English |
|---|---|
| `identity.badge` | Demo simulation |
| `identity.disclosureTitle` | Demo simulation only. |
| `identity.disclosureBody` | This prototype is not connected to the live UAE PASS service. |
| `identity.introTitle` | Verify your identity for this demo |
| `identity.introBody` | This prototype includes a simulated identity step so you can experience the complete MARKAZ onboarding journey. |
| `identity.start` | Start demo verification |
| `identity.starting` | Starting demo verification… |
| `identity.pendingTitle` | Demo verification in progress |
| `identity.pendingBody` | Your demo identity check has started. Use the simulation controls below to choose the result. |
| `identity.pendingStatus` | Pending · Demo |
| `identity.controlsTitle` | Demo simulation controls |
| `identity.controlsBody` | These controls are available only in the prototype and do not connect to UAE PASS. |
| `identity.approve` | Approve demo verification |
| `identity.reject` | Reject |
| `identity.saving` | Saving demo result… |
| `identity.successTitle` | Demo identity verified |
| `identity.successBody` | Your account setup is complete. You can now browse properties, make offers, and list a property. |
| `identity.successStatus` | Verified · Demo |
| `identity.dashboard` | Go to dashboard |
| `identity.failureTitle` | Demo verification was not completed |
| `identity.failureBody` | No official identity check was performed. Try the simulation again to continue. |
| `identity.failureStatus` | Unsuccessful · Demo |
| `identity.retry` | Try again |

## 25.9 Sessions and errors

| Key | English |
|---|---|
| `session.expiredTitle` | Your session has expired |
| `session.expiredBody` | For your security, please sign in again. We will return you to a safe page where possible. |
| `session.signedOutTitle` | You are signed out |
| `session.signedOutBody` | Your MARKAZ session has ended. |
| `session.browse` | Browse properties |
| `error.providerTitle` | Sign-in service temporarily unavailable |
| `error.providerBody` | We cannot connect to the authentication service right now. Your non-sensitive progress has been preserved. |
| `error.rateTitle` | Too many attempts |
| `error.rateBody` | Please wait {time} before trying again. |
| `error.genericTitle` | Something went wrong |
| `error.genericBody` | We could not complete this request. Try again. |
| `error.reference` | Reference: {reference} |

## 25.10 Admin

| Key | English |
|---|---|
| `admin.brand` | MARKAZ Operations |
| `admin.authorised` | Authorised access only |
| `admin.signinTitle` | Sign in to Operations |
| `admin.signinBody` | Use your authorised MARKAZ Admin account. |
| `admin.security` | Access is restricted to authorised MARKAZ personnel. |
| `admin.forgotTitle` | Reset your Admin password |
| `admin.forgotBody` | Enter the email address for your authorised MARKAZ Admin account. |
| `admin.returnSignIn` | Return to Admin sign in |
| `admin.resetTitle` | Choose a new Admin password |
| `admin.resetBody` | Create a secure password for your MARKAZ Operations account. |
| `admin.deniedTitle` | Access denied |
| `admin.deniedBody` | This account does not have permission to access MARKAZ Operations. |
| `admin.deniedHelp` | Sign out and use an authorised Admin account. |
| `admin.returnHome` | Return to MARKAZ Home |
| `admin.expiredTitle` | Your Admin session has expired |
| `admin.expiredBody` | For security, sign in again to continue using MARKAZ Operations. |
| `admin.signedOutTitle` | You are signed out of MARKAZ Operations |
| `admin.signedOutBody` | Your Admin session has ended. |
| `admin.return` | Return to Admin sign in |

---

# 26. Arabic Copy and Review Flags

## 26.1 Approval status

All Arabic in this specification is **draft product copy** and requires professional Arabic-language review before release.

- Ordinary interface copy: professional language review required
- Security-sensitive copy: language and security review required
- Terms, Privacy, and legal acceptance: professional legal and language review required
- UAE PASS simulation wording: business/legal and language review required

Do not label any Arabic legal or identity wording as approved until reviewed.

## 26.2 Draft core Arabic copy

| English | Draft Arabic | Review |
|---|---|---|
| Create your MARKAZ account | أنشئ حسابك في MARKAZ | Language |
| One account lets you browse properties, make offers, list a property, and track transactions. | يتيح لك حساب واحد تصفح العقارات وتقديم العروض وإدراج عقارك ومتابعة المعاملات. | Language |
| Full name | الاسم الكامل | Language |
| Enter your full name | أدخل اسمك الكامل | Language |
| Email address | البريد الإلكتروني | Language |
| Password | كلمة المرور | Language |
| Confirm password | تأكيد كلمة المرور | Language |
| Create account | إنشاء حساب | Language |
| Already have an account? | لديك حساب بالفعل؟ | Language |
| Sign in | تسجيل الدخول | Language |
| I agree to the Terms of Use. | أوافق على شروط الاستخدام. | Legal + language |
| I agree to the Privacy Policy. | أوافق على سياسة الخصوصية. | Legal + language |
| Your password must include: | يجب أن تتضمن كلمة المرور ما يلي: | Language |
| At least 8 characters | 8 أحرف على الأقل | Language |
| One uppercase letter | حرف إنجليزي كبير واحد | Language |
| One lowercase letter | حرف إنجليزي صغير واحد | Language |
| One number | رقم واحد | Language |
| One special character | رمز خاص واحد | Language |
| Show password | إظهار كلمة المرور | Language |
| Hide password | إخفاء كلمة المرور | Language |
| Check your email | تحقّق من بريدك الإلكتروني | Language |
| We sent a six-digit verification code to {email}. | أرسلنا رمز تحقق مكوّنًا من ستة أرقام إلى {email}. | Security + language |
| Verify your email | تحقّق من بريدك الإلكتروني | Language |
| Verification code | رمز التحقق | Language |
| Verify email | التحقق من البريد الإلكتروني | Language |
| Resend code | إعادة إرسال الرمز | Language |
| Resend code in {time} | يمكنك إعادة إرسال الرمز خلال {time} | Language |
| Use a different email | استخدام بريد إلكتروني آخر | Language |
| Email verified | تم التحقق من البريد الإلكتروني | Language |
| Welcome back | مرحبًا بعودتك | Language |
| Sign in to manage your properties, offers, and transactions. | سجّل الدخول لإدارة عقاراتك وعروضك ومعاملاتك. | Language |
| Forgot password? | هل نسيت كلمة المرور؟ | Language |
| New to MARKAZ? | جديد في MARKAZ؟ | Language |
| The email or password is incorrect. | البريد الإلكتروني أو كلمة المرور غير صحيحة. | Security + language |
| Reset your password | إعادة تعيين كلمة المرور | Language |
| Send recovery email | إرسال رسالة استعادة | Language |
| If an account exists for this email, password recovery instructions have been sent. | إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فقد تم إرسال تعليمات استعادة كلمة المرور. | Security + language |
| Choose a new password | اختر كلمة مرور جديدة | Language |
| New password | كلمة المرور الجديدة | Language |
| Confirm new password | تأكيد كلمة المرور الجديدة | Language |
| Update password | تحديث كلمة المرور | Language |
| Password updated | تم تحديث كلمة المرور | Language |
| Complete your profile | أكمل ملفك الشخصي | Language |
| Save and continue | حفظ ومتابعة | Language |
| Demo simulation | محاكاة تجريبية | Business/legal + language |
| Demo simulation only. | محاكاة تجريبية فقط. | Business/legal + language |
| This prototype is not connected to the live UAE PASS service. | هذا النموذج الأولي غير متصل بخدمة UAE PASS الفعلية. | Business/legal + language |
| Verify your identity for this demo | تحقّق من هويتك لأغراض هذا العرض التجريبي | Business/legal + language |
| Start demo verification | بدء التحقق التجريبي | Business/legal + language |
| Demo verification in progress | التحقق التجريبي قيد التنفيذ | Business/legal + language |
| Approve demo verification | اعتماد نتيجة التحقق التجريبي | Business/legal + language |
| Reject | رفض | Language |
| Demo identity verified | تم التحقق من الهوية تجريبيًا | Business/legal + language |
| Go to dashboard | الانتقال إلى لوحة التحكم | Language |
| Demo verification was not completed | لم يكتمل التحقق التجريبي | Business/legal + language |
| Try again | المحاولة مرة أخرى | Language |
| Your session has expired | انتهت صلاحية جلستك | Security + language |
| You are signed out | تم تسجيل خروجك | Language |
| Sign-in service temporarily unavailable | خدمة تسجيل الدخول غير متاحة مؤقتًا | Language |
| Too many attempts | عدد كبير جدًا من المحاولات | Security + language |
| Something went wrong | حدث خطأ ما | Language |
| MARKAZ Operations | عمليات MARKAZ | Brand review |
| Authorised access only | الدخول للمصرّح لهم فقط | Security + language |
| Sign in to Operations | تسجيل الدخول إلى بوابة العمليات | Language |
| Access denied | تم رفض الوصول | Security + language |
| This account does not have permission to access MARKAZ Operations. | لا يملك هذا الحساب صلاحية الوصول إلى بوابة عمليات MARKAZ. | Security + language |
| Return to MARKAZ Home | العودة إلى MARKAZ Home | Brand + language |

## 26.3 Arabic legal links

The Arabic titles for Terms of Use and Privacy Policy must match the final legal documents exactly. Do not rely on the draft labels in this design specification if legal counsel provides different approved document names.

---

# 27. Design-to-Engineering Handoff Tables

## 27.1 Customer screens — route and interaction

| ID | Route | Screen | User | Entry condition | Required data | Primary action | Secondary actions | Components |
|---|---|---|---|---|---|---|---|---|
| C-01 | `/[locale]` | Landing auth entry | Public | Anonymous visitor | Optional safe intent | Sign in or gated CTA | Browse, Create account path | Public header, links |
| C-02 | `/[locale]/sign-up` | Create Account | Public | No active customer session | Name, email, password, legal acceptance, safe intent | Create account | Sign in, legal links, back home | Auth shell, progress, inputs, checklist, checkboxes |
| C-03 | `/[locale]/sign-up/check-email` | Check Your Email | New customer | Account created, email unverified | Masked email | Enter verification code | Change email | Success panel, masked email |
| C-04 | `/[locale]/verify-email` | Verify Email | Customer pending verification | Unverified account/session | Masked email, code state, resend time | Verify email | Resend, change email | Progress, OTP, countdown, alerts |
| C-05 | `/[locale]/verify-email/success` | Email Verified | Customer | Verification success | Next onboarding state | Continue to next required step | None | Success panel |
| C-06 | `/[locale]/onboarding/profile` | Profile Completion | Authenticated CUSTOMER | Missing required profile data | Missing fields, verified email | Save and continue | Sign out | Progress/status, form controls |
| C-07 | `/[locale]/onboarding/uae-pass` | UAE PASS Intro | Authenticated CUSTOMER | `NOT_STARTED` | Identity status, safe intent | Start demo verification | Sign out | Simulation badge, info panel |
| C-08 | Same route/state | UAE PASS Pending | Authenticated CUSTOMER | `PENDING` | Identity record | Approve demo verification | Reject, sign out | Status, simulation controls |
| C-09 | Same route/state | UAE PASS Success | Authenticated CUSTOMER | `VERIFIED_DEMO` | Safe destination | Go to dashboard / Continue | None | Success panel, demo badge |
| C-10 | Same route/state | UAE PASS Failure | Authenticated CUSTOMER | `FAILED_DEMO` | Identity state | Try again | Sign out | Error panel, demo badge |
| C-11 | `/[locale]/sign-in` | Sign In | Public / expired | No valid customer session | Email, password, safe return | Sign in | Forgot password, Create account | Auth form, notice slot |
| C-12 | `/[locale]/forgot-password` | Forgot Password | Public | User requests recovery | Email | Send recovery email | Return to sign in | Email form |
| C-13 | `/[locale]/forgot-password/check-email` | Recovery Email Sent | Public | Recovery request complete | Optional masked email, cooldown | Return to sign in | Send again, change email | Success panel, countdown |
| C-14 | `/[locale]/reset-password` | Reset Password | Recovery session | Valid provider recovery session | New password, confirm | Update password | Return to sign in | Password components |
| C-15 | `/[locale]/reset-password/success` | Password Updated | Public | Reset success | None | Sign in | None | Success panel |
| C-16 | `/[locale]/sign-in?notice=session-expired` | Session Expired | Customer | Session invalidated | Safe return | Sign in | Browse properties | Session notice + Sign In |
| C-17 | `/[locale]/signed-out` | Signed Out | Public | Sign out success | None | Sign in | Browse properties | Success panel |
| C-18 | `/[locale]/auth/unavailable` or route state | Provider Unavailable | Any auth user | Persistent provider/network failure | Safe retry context | Try again | Return home | Error panel |
| C-19 | Current auth route state | Rate Limited | Any auth user | Provider/server limit | Retry time | Retry when available | Return/back | Form alert, countdown |
| C-20 | `/[locale]/auth/error` or boundary | Unexpected Error | Any | Unhandled safe failure | Support reference | Try again | Return home | Error panel |

## 27.2 Customer screens — states, destinations, and implementation notes

| ID | Loading state | Empty state | Error states | Success destination | Responsive notes | RTL notes | Accessibility notes | Claude Code notes |
|---|---|---|---|---|---|---|---|---|
| C-01 | Existing landing loading | N/A | N/A | Sign In or Sign Up | Existing approved landing behaviour | Header mirrors | Links labelled | Preserve `returnTo` only for allowlisted customer paths |
| C-02 | Creating account | N/A | Validation, duplicate-safe, provider, rate | C-03 | Support panel hidden tablet/mobile | Password/email LTR | Error summary; autocomplete | Replace OTP sign-in registration mechanic; idempotent profile creation |
| C-03 | None | N/A | Provider state if code dispatch failed | C-04 | Centred status | Masked email LTR | Focus heading | Reuse existing code-sent state |
| C-04 | Verifying/resending | Six blank digits | Invalid, expired, attempts, rate, provider | C-05 | OTP cells minimum sizes | Digits LTR | One logical input | Reuse/refine Week 1 OTP component for verification only |
| C-05 | Checking next step | N/A | Route-resolution error | C-06/C-07/C-08/C-10/C-09 | Centred | Standard | Focus heading, announce success | Server resolves next state |
| C-06 | Saving profile | Only rendered if data missing | Validation, save error | Current identity state | Single column | Logical alignment | Only missing fields | Reuse profile model and resolver |
| C-07 | Starting demo | N/A | Start failure | C-08 | Panel stacks | Mirrors except brand terms | Disclosure read before action | Keep persisted status |
| C-08 | Saving result | N/A | Result-save error | C-09 or C-10 | Buttons stack mobile | Logical order | Status announced | Prototype-only controls behind service interface |
| C-09 | Resolving destination | N/A | Destination fallback | Safe route / dashboard | Full-width mobile action | Standard | Focus success heading | Consume safe intent once |
| C-10 | Restarting | N/A | Retry failure | C-07/C-08 | Stack actions | Standard | Error not colour-only | Do not use official rejection wording |
| C-11 | Signing in / resolving | Empty fields | Validation, credentials, unverified, unavailable, rate | Current onboarding or safe route | Support panel hidden mobile | Values LTR | Password manager compatible | Email/password Supabase flow; generic errors |
| C-12 | Sending | Empty email | Validation, provider, rate | C-13 | Compact form | Email LTR | Generic response | Official supported recovery method |
| C-13 | Resending | N/A | Provider/rate | C-11 | Status panel | Email/time LTR | Generic confirmation | Do not branch copy on account existence |
| C-14 | Validating recovery/saving | N/A | Invalid/expired session, validation, provider | C-15 | No support image required mobile | Password LTR | New-password autocomplete | Do not log recovery token |
| C-15 | None | N/A | N/A | C-11 | Centred | Standard | Focus heading | No automatic sign-in |
| C-16 | Signing in | Empty form | Same as C-11 | Safe route/dashboard | Same as Sign In | Same | Notice before form | Allowlist return route |
| C-17 | None | N/A | Sign-out failure should retry before route | Public | Status panel | Standard | Focus heading | Clear protected return intent |
| C-18 | Retrying | N/A | Persistent unavailable | Previous safe auth route | Centred panel | Standard | Focus error heading | Preserve non-sensitive fields only |
| C-19 | Countdown | N/A | Continued limit | Current route | Alert wraps | Time LTR | No per-second announcement | Server retry time source |
| C-20 | Retrying | N/A | Persistent failure | Previous safe route | Centred | Standard | Safe reference only | Error boundary; no stack trace |

## 27.3 Admin screens — route and interaction

| ID | Route | Screen | User | Entry condition | Required data | Primary action | Secondary actions | Components |
|---|---|---|---|---|---|---|---|---|
| A-01 | `/[locale]/sign-in` | Admin Sign In | Public/Admin | No valid Admin session | Email, password | Sign in | Forgot password | Admin shell, form |
| A-02 | `/[locale]/forgot-password` | Admin Forgot Password | Public | Recovery requested | Email | Send recovery email | Return to Admin sign in | Admin shell, email form |
| A-03 | `/[locale]/forgot-password/check-email` | Admin Recovery Sent | Public | Recovery request complete | Cooldown | Return to Admin sign in | Send again | Success panel |
| A-04 | `/[locale]/reset-password` | Admin Reset Password | Recovery session | Valid recovery session | New password, confirm | Update password | Return to Admin sign in | Password components |
| A-05 | `/[locale]/reset-password/success` | Admin Password Updated | Public | Reset complete | None | Return to Admin sign in | None | Success panel |
| A-06 | `/[locale]/access-denied` | Admin Access Denied | Authenticated non-Admin | Account-type check fails | Authenticated user state | Sign out | Return to MARKAZ Home | Access-denied state |
| A-07 | `/[locale]/sign-in?notice=session-expired` | Admin Session Expired | Admin | Session invalid | Allowlisted Admin return | Sign in | None | Notice + Admin Sign In |
| A-08 | `/[locale]/signed-out` | Admin Signed Out | Public | Admin sign out complete | None | Return to Admin sign in | None | Success panel |

## 27.4 Admin screens — states, destinations, and implementation notes

| ID | Loading state | Error states | Success destination | Responsive notes | RTL notes | Accessibility notes | Claude Code notes |
|---|---|---|---|---|---|---|---|
| A-01 | Signing in + account check | Validation, generic credentials, rate, provider | Overview or A-06 | Hide side panel mobile | Values LTR | Password manager support | Account-type check before rendering portal |
| A-02 | Sending | Validation, provider, rate | A-03 | Compact | Email LTR | Generic confirmation | Same recovery service; Admin app origin |
| A-03 | Resending | Provider, rate | A-01 | Centred | Time LTR | Status heading focus | Do not reveal Admin-account existence |
| A-04 | Validating/saving | Invalid recovery, validation, provider | A-05 | Single column | Password LTR | New-password autocomplete | Validate redirect belongs to Admin app |
| A-05 | None | N/A | A-01 | Centred | Standard | Focus heading | End recovery session |
| A-06 | Signing out | Sign-out retry | A-08 | Centred | Standard | No portal controls exposed | Record non-sensitive denial event |
| A-07 | Signing in | Sign-in errors | Allowlisted Admin route/Overview | Same as A-01 | Same | Notice before form | Re-check `ADMIN` on every session |
| A-08 | None | N/A | A-01 | Centred | Standard | Focus heading | Clear Admin return intent |

## 27.5 Requirement-type labels for engineering tickets

Use these labels in Claude Code subtasks:

- **[VISUAL]** Colour, typography, spacing, layout, responsive presentation
- **[INTERACTION]** Focus, validation timing, loading, resend, routing, input behaviour
- **[PRODUCT]** Unified customer, no roles, onboarding order, copy meaning
- **[SECURITY]** Generic errors, provider flow, account-type checks, token handling, safe redirects
- **[ACCESSIBILITY]** Keyboard, labels, announcements, contrast, OTP, autofill
- **[I18N]** English/Arabic catalogues, RTL, bidi isolation
- **[OPTIONAL]** Enhancement that may be deferred without breaking acceptance

---

# 28. Open Design Decisions

The specification is implementation-ready, but these items require owner confirmation or review before production release.

| Decision | Current specification | Owner / review |
|---|---|---|
| Final production SVG logo | Working concept: M + architectural home symbol + RKAZ | Brand / design |
| Final Terms URL and legal version | Separate required Terms checkbox | Legal/product |
| Final Privacy URL and legal version | Separate required Privacy checkbox | Legal/privacy |
| Arabic Terms and Privacy wording | Draft only | Arabic legal counsel |
| Arabic product copy | Draft provided | Professional Arabic reviewer |
| UAE PASS simulation Arabic wording | Draft provided | Business/legal + Arabic reviewer |
| Verification-code expiry | Do not hard-code in copy; provider configuration governs | Engineering/security |
| Resend cooldown | 60-second UI default; server governs | Engineering/security |
| Failed-code attempt threshold | Provider/server governs; UI supports too-many-attempts state | Engineering/security |
| Recovery-link expiry | Do not state duration until configured | Engineering/security |
| Admin recovery sender/domain | Same supported provider flow; application-specific redirect | Platform/security |
| Support contact route | Copy currently says contact MARKAZ support without a link | Product/operations |
| Account-unavailable reason policy | Generic message | Security/operations |
| Whether Account Created is separate route | Recommended separate state/route | Product/engineering |
| Whether demo identity auto-resolves in seeded demos | Manual Approve/Reject by default | Demo owner |

None of these open items should cause engineering to invent UI structure. Where a value is unknown, use the generic wording defined in this document.

---

# 29. Final Acceptance Checklist

## Product and account model

- [ ] Customer and Admin applications remain separate
- [ ] `CUSTOMER` and `ADMIN` are the only account types used here
- [ ] Buyer and Seller are not account roles
- [ ] No Buyer/Seller role-selection screen exists
- [ ] No public Admin registration exists
- [ ] No Admin link exists in customer web
- [ ] Customer account signing into Operations reaches Access Denied
- [ ] Admin account type is checked server-side before portal rendering

## Customer account creation

- [ ] Separate Create Account and Sign In routes exist
- [ ] Create Account includes Full name
- [ ] Create Account includes Email address
- [ ] Create Account includes Password
- [ ] Create Account includes Confirm password
- [ ] Terms and Privacy are separate required checkboxes
- [ ] No phone, Emirates ID, passport, property, or social-login fields exist
- [ ] Password requirements are live and accessible
- [ ] Password strength is calm and supplementary
- [ ] Confirm password matching works
- [ ] Duplicate-account response is safe and generic
- [ ] Password values are not persisted

## Email verification

- [ ] Email verification is required after sign-up
- [ ] Six-digit verification code is supported
- [ ] Masked email is shown
- [ ] Full-code paste works
- [ ] Auto-advance and backspace work
- [ ] OTP remains LTR in Arabic
- [ ] Resend cooldown works
- [ ] Invalid, expired, resent, too-many-attempts, rate-limit, provider, already-verified, and success states exist
- [ ] Verification code is never stored in audit or persistent UI state

## Sign In and routing

- [ ] Normal sign-in uses email and password
- [ ] Incorrect credentials use one generic message
- [ ] Unverified customer is routed to Verify Email
- [ ] Missing profile is routed to Profile Completion
- [ ] UAE PASS `NOT_STARTED`, `PENDING`, `FAILED_DEMO`, and `VERIFIED_DEMO` route correctly
- [ ] Returning complete customer reaches safe destination or Dashboard
- [ ] Browser refresh uses server state
- [ ] Safe internal intent is restored once
- [ ] Open redirects are prevented

## Password recovery

- [ ] Forgot Password exists
- [ ] Generic recovery confirmation is always used
- [ ] Official supported Supabase recovery flow is used
- [ ] Reset Password includes new and confirm fields
- [ ] Reset Password uses sign-up password requirements
- [ ] Invalid and expired recovery states exist
- [ ] Password Updated success exists
- [ ] Recovery tokens are never displayed or logged

## Simulated UAE PASS

- [ ] Demo disclosure appears on every simulation state
- [ ] No official UAE PASS branding or seals are used
- [ ] No Emirates ID or passport data is requested
- [ ] `NOT_STARTED` exists
- [ ] `PENDING` exists
- [ ] `VERIFIED_DEMO` exists
- [ ] `FAILED_DEMO` exists
- [ ] Start Demo Verification exists
- [ ] Approve Demo Verification exists
- [ ] Reject exists
- [ ] Try Again exists
- [ ] Success wording is exactly `Demo identity verified`
- [ ] Failure wording does not imply official rejection

## Sessions and Admin

- [ ] Sign Out exists in customer account menu
- [ ] Sign Out exists in Admin account menu
- [ ] Customer Signed-Out state exists
- [ ] Admin Signed-Out state exists
- [ ] Customer Session Expired state exists
- [ ] Admin Session Expired state exists
- [ ] Admin Forgot Password exists
- [ ] Admin Reset Password exists
- [ ] Admin Access Denied exists
- [ ] No Admin Create Account exists

## Errors and loading

- [ ] Provider unavailable state exists
- [ ] Rate-limited state exists
- [ ] Generic unexpected-error state exists
- [ ] All primary actions have loading labels
- [ ] Double submission is prevented
- [ ] Field errors appear near fields
- [ ] Form-level alerts are used appropriately
- [ ] No raw provider or server error is shown
- [ ] No white-screen failure is possible

## Responsive, Arabic, and accessibility

- [ ] Desktop layout matches the defined widths and split behaviour
- [ ] Tablet removes supporting panel
- [ ] Mobile works at 320 px
- [ ] English message catalogue is complete
- [ ] Arabic message catalogue is present
- [ ] Arabic copy is flagged for review
- [ ] RTL mirrors logical layout
- [ ] Email, password, OTP, countdown, and references remain LTR
- [ ] WCAG 2.2 AA contrast is met
- [ ] Visible labels exist
- [ ] Errors are programmatically associated
- [ ] Error summary works
- [ ] Focus management is implemented
- [ ] Keyboard navigation works
- [ ] Touch targets meet 44 × 44 px
- [ ] Loading and results are announced
- [ ] OTP is accessible as one logical input
- [ ] Password visibility control is accessible
- [ ] Autofill and password managers work
- [ ] Reduced motion is respected
- [ ] Axe checks cover key routes

## Audit and data safety

- [ ] No product analytics were added
- [ ] Account profile completion may emit an audit event
- [ ] Email verification may emit an audit event
- [ ] Demo identity start, success, and failure may emit audit events
- [ ] Password recovery request may emit a non-sensitive audit event
- [ ] Password reset completion may emit an audit event
- [ ] Admin access denied may emit an audit event
- [ ] Passwords are never captured
- [ ] Verification codes are never captured
- [ ] Recovery tokens are never captured
- [ ] Access tokens are never captured
- [ ] Refresh tokens are never captured
- [ ] Raw authentication request bodies are not logged

---

## Appendix A — Meaningful Non-Sensitive Audit Events

These are application audit considerations, not product analytics.

| Event | When | Safe metadata |
|---|---|---|
| `account.profile_completed` | Required profile fields saved | User ID, timestamp, profile version |
| `auth.email_verified` | Email verification completes | User ID, timestamp, verification method category |
| `identity.demo_started` | Demo verification begins | User ID, identity record ID, timestamp |
| `identity.demo_verified` | Demo result approved | User ID, identity record ID, timestamp, `VERIFIED_DEMO` |
| `identity.demo_failed` | Demo result rejected | User ID, identity record ID, timestamp, `FAILED_DEMO` |
| `auth.password_recovery_requested` | Recovery request accepted by application | Timestamp, request result category; user ID only if safely resolved server-side |
| `auth.password_reset_completed` | Password update completes | User ID, timestamp |
| `auth.admin_access_denied` | Authenticated non-Admin reaches Operations | User ID, account type, timestamp, application ID |
| `auth.session_signed_out` | Optional sign-out audit | User ID, timestamp, application ID |

Never include:

- Password
- Password hint
- Verification code
- Recovery URL or token
- Access token
- Refresh token
- Cookie value
- Full request body
- Raw provider error payload

---

## Appendix B — Final Design Intent

The MARKAZ authentication experience should communicate:

> A secure, clear beginning to one unified property account.

It should not communicate:

- A generic SaaS product
- A bank or government portal
- A playful consumer app
- An official UAE PASS experience
- A separate buyer and seller system
- An Admin pathway available to the public

The final implementation should feel visually connected to the approved MARKAZ landing page through its architectural blue palette, editorial restraint, precise spacing, and approved home-arch wordmark, while remaining focused enough that account creation and recovery are fast, understandable, and accessible.
