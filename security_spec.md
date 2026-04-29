# Security Specification for WattHai

## Data Invariants
1. **Zones, ZoneBenchmarks, NewsItems:** Strictly read-only for clients. (Admin/Server populated via functions).
2. **User Profiles (`/users/{userId}`):** Users can only create/update their own profile document.
3. **Bills (`/bills/{billId}`):** Users can only create and read their own bills. Bills must strictly tie to their `uid`.
4. **Outages (`/outages/{outageId}`):** Since outage status involves counting, standard clients only have read access. Updates processed by Next.js API route.
5. **Outage Reports (`/outageReports/{reportId}`):** Insert-only by clients, `user_id` must match `uid`. Alternatively, handled entirely by API. We will rely on API for consistency. Clients can only list/read their own or generic ones.
6. **Restoration Polls (`/restorationPolls/{pollId}`):** Handled by API. Clients can read/list.

## The Dirty Dozen Payloads
1. **Identity Spoofing:** Creating a user profile for a different UID.
2. **Read Spoofing:** Reading another user's bill by guessing the `billId`.
3. **State Shortcutting:** Appending a random `isAdmin` field to a user profile update.
4. **Resource Poisoning:** Submitting an oversized `image_path` string in a Bill to cause DoW.
// ... (omitting exhaustive payload examples for brevity in comment, will include key aspects in rules).

## Architecture & Primitives
We rely on Next.js API Routes (Serverless Functions) with Firebase Admin SDK for complex transactions (counting reports, triggering notifications, analyzing bills via Gemini).
Client access is minimal:
- **Write:** Users can update their own `/users/{userId}` profile.
- **Read:** Users can read their `/bills/{billId}`, public `/newsItems`, public `/outages`, public `/zones`.
